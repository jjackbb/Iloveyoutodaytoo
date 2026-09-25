/**
 * 추억 영상 검사 규칙 (2026-09-26 사용자 결정).
 *
 * - 한 추억에 영상은 최대 한 개. 파일 선택과 앱 안 촬영 모두 받는다.
 * - 길이: 최소 없음 · 최대 30초. 빈 파일은 받지 않는다.
 * - 크기: 30초 이하라도 50MB를 넘으면 올리기 전에 이유를 알리고 다시 고르게 한다.
 *   자동 압축은 이번 범위가 아니다.
 *
 * 브라우저·서버 양쪽에서 쓰도록 DOM을 쓰지 않는 순수 함수만 둔다.
 * 같은 숫자는 lib/limits.ts 와 DB(memories_video_pair, video 버킷)에 있다.
 */

import { VIDEO_MAX_BYTES, VIDEO_MAX_MS, VIDEO_MIME_TYPES } from '@/lib/limits'

export const VIDEO_BUCKET = 'video'

export type VideoMime = (typeof VIDEO_MIME_TYPES)[number]

/** 확장자로 형식을 짐작할 때 쓰는 표. 형식이 비어 오는 기기가 있다. */
const MIME_BY_EXTENSION: Record<string, VideoMime> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
}

const EXTENSION_BY_MIME: Record<VideoMime, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

/**
 * 파일 형식을 버킷이 받는 세 가지 중 하나로 맞춘다. 못 맞추면 null.
 * `video/webm;codecs=vp8,opus` 처럼 뒤에 붙은 것은 뗀다(MediaRecorder가 이렇게 준다).
 */
export function normalizeVideoMime(type: string, fileName = ''): VideoMime | null {
  const base = type.split(';')[0]?.trim().toLowerCase() ?? ''
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(base)) return base as VideoMime
  if (base && base !== 'application/octet-stream') return null
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? null
}

export function extensionForVideoMime(mime: VideoMime): string {
  return EXTENSION_BY_MIME[mime]
}

export type VideoFileCheck =
  | { ok: true; mime: VideoMime }
  | { ok: false; reason: 'type' | 'empty' | 'size'; message: string }

/** 올리기 전 파일 자체 검사(형식·빈 파일·크기). 길이는 따로 잰다. */
export function checkVideoFile(file: {
  size: number
  type: string
  name?: string
}): VideoFileCheck {
  const mime = normalizeVideoMime(file.type, file.name)
  if (!mime) {
    return {
      ok: false,
      reason: 'type',
      message: 'mp4·webm·mov 영상만 담을 수 있어요. 다른 영상을 골라 주세요.',
    }
  }
  if (file.size <= 0) {
    return {
      ok: false,
      reason: 'empty',
      message: '영상 파일이 비어 있어요. 다시 고르거나 찍어 주세요.',
    }
  }
  if (file.size > VIDEO_MAX_BYTES) {
    const mb = Math.ceil(file.size / (1024 * 1024))
    return {
      ok: false,
      reason: 'size',
      message: `영상이 ${mb}MB라 담을 수 없어요. 50MB 이하로 다시 고르거나 짧게 찍어 주세요.`,
    }
  }
  return { ok: true, mime }
}

export type VideoDurationCheck =
  | { ok: true; durationMs: number }
  | { ok: false; reason: 'duration' | 'unreadable'; message: string }

/** 잰 길이(초)를 검사한다. 읽지 못했으면(null·NaN·무한) 받지 않는다. */
export function checkVideoDuration(seconds: number | null): VideoDurationCheck {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return {
      ok: false,
      reason: 'unreadable',
      message: '이 영상의 길이를 확인하지 못했어요. 다른 영상을 고르거나 바로 찍어 주세요.',
    }
  }
  const durationMs = Math.round(seconds * 1000)
  if (durationMs > VIDEO_MAX_MS) {
    return {
      ok: false,
      reason: 'duration',
      message: `영상은 ${VIDEO_MAX_MS / 1000}초까지 담을 수 있어요. 지금 영상은 ${Math.ceil(seconds)}초예요.`,
    }
  }
  return { ok: true, durationMs }
}

/** 카메라 권한·장치 오류를 사용자가 알아들을 말로 바꾼다(VoiceRecorder의 마이크 문구와 같은 결). */
export function describeCameraError(error: unknown): string {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name: unknown }).name)
      : ''

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '카메라 사용이 허용되지 않았어요. 주소창 옆 자물쇠 아이콘에서 카메라·마이크를 "허용"으로 바꾸거나, 파일에서 골라 주세요.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '이 기기에서 카메라를 찾지 못했어요. 파일에서 골라 주세요.'
    case 'NotReadableError':
    case 'TrackStartError':
      return '다른 앱이 카메라를 쓰고 있는 것 같아요. 그 앱을 닫고 다시 눌러 주세요.'
    case 'SecurityError':
      return '보안 설정 때문에 카메라를 쓸 수 없어요. 파일에서 골라 주세요.'
    default:
      return '카메라를 켜지 못했어요. 잠시 후 다시 누르거나 파일에서 골라 주세요.'
  }
}

/** 영상 길이를 "0:07" 모양으로. */
export function formatVideoDuration(durationMs: number): string {
  const total = Math.max(0, Math.round(durationMs / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
