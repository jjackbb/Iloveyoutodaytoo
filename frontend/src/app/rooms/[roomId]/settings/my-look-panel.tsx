'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { CoverCropDialog } from '@/app/rooms/new/cover-crop-dialog'
import { Button } from '@/components/ui/Button'
import { Field, FieldShell } from '@/components/ui/Field'
import { updateMyRoomLook, type RoomLookState } from '@/lib/actions/rooms'
import { COVER_PRESET_LIST, coverStyle } from '@/lib/covers'
import { ROOM_NAME_MAX_LENGTH } from '@/lib/limits'

/**
 * 내 화면에서 이 방을 부를 이름과 커버 (노션 IA 6.7 개정).
 *
 * **여기서 바꾼 것은 나만 본다.** 카카오톡 단체방과 같다 — 처음 만든 사람이 정해둔
 * 이름과 커버가 기본이고, 그 뒤로는 각자 자기 화면에서만 바꿔 부른다.
 * (그전에는 방장만 바꿀 수 있었고 모두의 화면이 함께 바뀌었다. 사용자 결정 2026-08-20)
 *
 * 그래서 방장 여부로 가리지 않는다 — 모든 구성원에게 보인다.
 *
 * 잔여데이터가 아닌 이유: 이 부품이 들고 있는 것은 **저장 전 초안**뿐이다.
 * 저장하면 서버가 다시 읽어 내려준 값으로 화면이 덮이고, 이 상태는 버려진다.
 */
export function MyLookPanel({
  roomId,
  originalName,
  customName,
  /** 방을 만들 때 정해진 커버 — [원래대로] 타일에 그대로 보여준다. */
  originalCoverPreset,
  originalCoverUrl,
  /** 내가 고른 프리셋(없으면 null). */
  customCoverPreset,
  /** 내가 올린 커버 사진의 보이는 주소(없으면 null). */
  customCoverUrl,
}: {
  roomId: string
  originalName: string
  customName: string | null
  originalCoverPreset: string | null
  originalCoverUrl: string | null
  customCoverPreset: string | null
  customCoverUrl: string | null
}) {
  const [state, formAction, pending] = useActionState<RoomLookState, FormData>(
    updateMyRoomLook,
    null,
  )

  const [name, setName] = useState(customName ?? '')

  /**
   * 지금 골라져 있는 커버.
   * 'original' = 방에 정해진 커버 그대로, 그 밖에는 프리셋 키.
   * 직접 올린 사진이 따로 잡혀 있으면(cropped·customCoverUrl) 그것이 이긴다.
   */
  const [choice, setChoice] = useState<string>(
    customCoverPreset ?? 'original',
  )

  /** 서버에 저장돼 있는 내 커버 사진을 이 화면에서 계속 쓸 것인가. */
  const [keepUploaded, setKeepUploaded] = useState(Boolean(customCoverUrl))

  /** 방금 고른 원본(자르기 대기). */
  const [pickedFile, setPickedFile] = useState<File | null>(null)

  /** 자르기까지 끝난 새 커버. 있으면 저장할 때 이것이 올라간다. */
  const [cropped, setCropped] = useState<{ file: File; preview: string } | null>(
    null,
  )

  /**
   * 잘라낸 파일을 폼에 실어 보내는 통로.
   * File은 value로 넣을 수 없어서(브라우저가 막는다) DataTransfer로 진짜 파일 목록을 만든다.
   * 방 만들기 폼과 같은 방식이다.
   */
  const croppedInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = croppedInputRef.current
    if (!input) return

    const transfer = new DataTransfer()
    if (cropped) transfer.items.add(cropped.file)
    input.files = transfer.files
  }, [cropped])

  /** 화면에 보이는 내 사진(새로 자른 것 우선, 없으면 저장돼 있던 것). */
  const photoPreview = cropped?.preview ?? (keepUploaded ? customCoverUrl : null)

  function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) setPickedFile(file)
    // 같은 사진을 다시 골라도 change가 일어나야 하므로 값을 비운다.
    event.target.value = ''
  }

  function removePhoto() {
    setCropped(null)
    setKeepUploaded(false)
    setChoice('original')
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="room_id" value={roomId} />
      {/*
        사진을 그대로 두는 경우에는 커버 칸을 아예 안 보낸다 —
        서버가 "커버는 손대지 말라"로 읽는다(actions/rooms.ts 참고).
      */}
      {photoPreview && !cropped ? null : (
        <input type="hidden" name="cover_preset" value={choice} />
      )}

      <Field
        id="my-room-name"
        name="name"
        label="이 방을 부를 이름"
        placeholder={originalName}
        // hint로 두면 낭독기가 입력칸과 함께 읽어준다(aria-describedby).
        hint={`비워두면 원래 이름 ‘${originalName}’으로 보여요.`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={ROOM_NAME_MAX_LENGTH}
        autoComplete="off"
        labelSuffix={`${name.length}/${ROOM_NAME_MAX_LENGTH}`}
        error={state?.status === 'error' ? state.message : null}
      />

      <FieldShell id="my-cover" label="커버 사진">
        <div
          id="my-cover"
          role="radiogroup"
          aria-label="커버 사진"
          className="grid grid-cols-4 gap-3"
        >
          {/* 되돌리는 길을 첫 칸에 둔다 — 바꿨다가 마음에 안 들 때 찾아 헤매지 않게. */}
          <CoverTile
            label="원래대로"
            checked={!photoPreview && choice === 'original'}
            onSelect={() => {
              setChoice('original')
              setCropped(null)
              setKeepUploaded(false)
            }}
            style={coverStyle(originalCoverPreset, originalCoverUrl)}
            showLabel
          />

          {COVER_PRESET_LIST.map(({ key, label, gradient }) => (
            <CoverTile
              key={key}
              label={label}
              checked={!photoPreview && choice === key}
              onSelect={() => {
                setChoice(key)
                setCropped(null)
                setKeepUploaded(false)
              }}
              style={{ backgroundImage: gradient }}
            />
          ))}

          {photoPreview ? (
            <div className="relative aspect-square rounded-inner border-2 border-primary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="내가 올린 커버 사진"
                className="h-full w-full rounded-[10px] object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                aria-label="올린 커버 사진 지우기"
                className="absolute -top-2 -right-2 flex h-11 w-11 items-center justify-center"
              >
                <span
                  aria-hidden
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow-chip"
                >
                  <MinusIcon />
                </span>
              </button>
            </div>
          ) : (
            <label
              className={[
                'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1',
                'rounded-inner border-2 border-dashed border-hairline-strong bg-card text-primary',
                'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary',
                'active:bg-primary-soft',
              ].join(' ')}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={pickFile}
                className="sr-only"
              />
              <CameraIcon />
              <span className="text-center text-sm leading-tight font-bold">
                직접
                <br />
                올리기
              </span>
            </label>
          )}
        </div>

        {/* 잘라낸 파일이 실려 나가는 칸. 화면에는 안 보이지만 폼의 일부다. */}
        <input
          ref={croppedInputRef}
          type="file"
          name="cover_file"
          accept="image/jpeg,image/png,image/webp"
          tabIndex={-1}
          aria-hidden
          className="hidden"
        />
      </FieldShell>

      {state?.status === 'done' ? (
        <p role="status" className="text-base text-muted">
          내 화면에 보이는 모습을 바꿨어요.
        </p>
      ) : null}

      <Button type="submit" variant="secondary" pending={pending} pendingText="저장 중…">
        저장
      </Button>

      {pickedFile ? (
        <CoverCropDialog
          file={pickedFile}
          onCancel={() => setPickedFile(null)}
          onConfirm={(file, preview) => {
            setCropped({ file, preview })
            setKeepUploaded(false)
            setPickedFile(null)
          }}
        />
      ) : null}
    </form>
  )
}

/** 커버 타일 하나. 고른 칸은 테두리 색과 체크 표시 **둘 다**로 알린다(색만으로 알리지 않는다). */
function CoverTile({
  label,
  checked,
  onSelect,
  style,
  showLabel = false,
}: {
  label: string
  checked: boolean
  onSelect: () => void
  style: React.CSSProperties
  showLabel?: boolean
}) {
  return (
    <label
      className={[
        'relative flex aspect-square cursor-pointer items-end justify-center',
        'overflow-hidden rounded-inner border-2 transition-colors',
        'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary',
        checked ? 'border-primary' : 'border-transparent',
      ].join(' ')}
      style={style}
    >
      <input
        type="radio"
        name="cover_choice"
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {showLabel ? (
        <span className="mb-1.5 rounded-full bg-ink/60 px-2 py-0.5 text-xs font-bold text-white">
          {label}
        </span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
      {checked && !showLabel ? (
        <span
          aria-hidden
          className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white"
        >
          <CheckIcon />
        </span>
      ) : null}
    </label>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5 5L19 7" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
    >
      <path d="M6 12h12" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8.5h3l1.4-2h7.2L17 8.5h3v10H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}
