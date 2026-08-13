/**
 * 브라우저에서 사진 크기를 줄인다.
 *
 * 왜 브라우저에서 하나:
 * 요즘 휴대폰 사진은 한 장에 3~8MB다. 10장이면 수십 MB인데, 그대로 올리면
 * 시니어 사용자가 많이 쓰는 불안정한 연결에서 거의 끝나지 않는다.
 * 저장 용량도 그만큼 잡아먹는다(마이 화면의 용량 게이지가 이 값을 센다).
 *
 * 긴 변 1600px·JPEG 품질 0.85면 휴대폰 화면에서 원본과 구분되지 않으면서
 * 한 장이 대개 300KB 안쪽이 된다.
 *
 * ⚠️ 브라우저 전용이다. document·canvas를 쓰므로 서버 컴포넌트에서 부르지 마라.
 */

/** 긴 변의 최대 길이(px). */
const MAX_EDGE = 1600

/** JPEG 품질. 더 낮추면 얼굴 주변에 얼룩이 보이기 시작한다. */
const QUALITY = 0.85

export interface ResizedPhoto {
  /** 올릴 파일. 항상 image/jpeg다. */
  file: File
  /** 화면에 바로 띄울 미리보기 주소(data:). 되돌려줄 것이 없어 뒷정리가 필요 없다. */
  preview: string
}

/** 파일 하나를 <img>로 읽어들인다. */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('파일을 읽지 못했다'))
    reader.onload = () => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('사진을 열지 못했다'))
      image.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

/**
 * 사진 한 장을 올릴 수 있는 크기로 줄인다.
 *
 * 원본이 이미 작아도 JPEG로 다시 굽는다 — HEIC·PNG 등 형식이 섞여 들어오면
 * Storage 허용 목록과 어긋나기 때문이다. 한 가지 형식으로 통일하는 편이 안전하다.
 */
export async function resizePhoto(file: File): Promise<ResizedPhoto> {
  const image = await loadImage(file)

  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas 2d context를 못 얻었다')
  context.drawImage(image, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  if (!blob) throw new Error('toBlob이 비었다')

  return {
    file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }),
    // 미리보기는 더 낮은 품질로 충분하다. 타일 한 변이 100px도 안 된다.
    preview: canvas.toDataURL('image/jpeg', 0.6),
  }
}
