'use client'

import { useEffect, useRef, useState, useTransition } from 'react'

import { COMMENT_END_ID } from './comment-anchor'
import {
  VoiceRecorder,
  type VoiceRecording,
} from '@/components/message/VoiceRecorder'
import { Button } from '@/components/ui/Button'
import {
  createTextComment,
  createVoiceComment,
  type CommentActionResult,
} from '@/lib/actions/comments'
import { TEXT_MAX_LENGTH, VOICE_MIN_SEC } from '@/lib/limits'
import { createClient } from '@/lib/supabase/client'

/**
 * 아래 고정 댓글바 (캡처 25) — 😊 이모지 + 입력칸 + 🎙 + 전송.
 *
 * 이 화면에서 상태를 들고 있는 유일한 자리다. 들고 있는 것은 **아직 보내지 않은 것**뿐이다
 * (쓰다 만 글, 방금 녹음한 소리). 보낸 뒤에는 서버가 다시 읽은 목록만 남는다.
 * 부모가 `key={memoryId}`를 붙여 다른 게시물로 옮기면 이 부품이 통째로 새로 만들어진다 —
 * 앞 게시물에 쓰다 만 글이 따라오지 않는다.
 *
 * 음성 파일은 브라우저가 Storage(voice 버킷)에 직접 올리고 서버 액션에는 **경로만** 준다
 * (마음 표현하기와 같은 방식). 경로는 `{room_id}/…` 이어야 Storage RLS를 통과한다.
 *
 * residue-scan-allow: dom-state-machine — 아래 `getElementById`는 화면을 바꾸는 것이 아니라
 * **목록 끝 자리 하나를 찾아 거기로 굴러가려고** 쓴다(캡처 33·36). 그 자리를 그리는 쪽은
 * 서버 컴포넌트(comment-list.tsx)라 ref로 잡을 방법이 없다. DOM에 무엇을 쓰지도, 화면을
 * 감추거나 되살리지도 않으므로 프로토타입의 화면 전환 방식과는 다르다.
 */

/** 이모지 팝오버에 놓이는 12개 (프로토타입 그대로). 이름은 낭독기에 읽힌다. */
const EMOJIS: { char: string; label: string }[] = [
  { char: '😀', label: '웃는 얼굴' },
  { char: '🥰', label: '하트 눈 얼굴' },
  { char: '😂', label: '눈물 나게 웃는 얼굴' },
  { char: '😊', label: '미소 짓는 얼굴' },
  { char: '😍', label: '하트 눈' },
  { char: '😭', label: '우는 얼굴' },
  { char: '❤️', label: '빨간 하트' },
  { char: '💕', label: '두 하트' },
  { char: '💗', label: '핑크 하트' },
  { char: '👍', label: '엄지척' },
  { char: '👏', label: '박수' },
  { char: '✨', label: '반짝임' },
]

const VOICE_BUCKET = 'voice'

/** 올리기가 실패했을 때 기다렸다 다시 보내는 간격. 총 3번 시도한다(작성 화면과 같다). */
const RETRY_DELAYS_MS = [1500, 4000]

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 파일 이름. crypto.randomUUID를 못 쓰는 환경도 있어 대비해 둔다. */
function randomFileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function CommentBar({
  roomId,
  memoryId,
}: {
  roomId: string
  memoryId: string
}) {
  const [text, setText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const inputRef = useRef<HTMLInputElement>(null)
  const emojiWrapRef = useRef<HTMLDivElement>(null)
  const emojiButtonRef = useRef<HTMLButtonElement>(null)
  /** 방금 댓글을 보냈는지. 서버가 목록을 다시 그린 뒤 그 자리로 굴러가려고 둔다. */
  const justSentRef = useRef(false)

  // 바깥을 누르거나 Esc를 누르면 이모지 팝오버를 접는다.
  useEffect(() => {
    if (!pickerOpen) return

    const onPointerDown = (event: PointerEvent) => {
      if (!emojiWrapRef.current?.contains(event.target as Node)) {
        setPickerOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPickerOpen(false)
        emojiButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pickerOpen])

  /*
    보낸 댓글이 목록에 붙은 뒤에 그 자리로 굴러간다 (캡처 33·36).
    액션이 끝난 직후에 굴리면 아직 옛 목록이라 한 줄 위에 멈춘다 —
    서버가 다시 그리는 것까지 끝나는 시점이 이 전환(pending)이 풀리는 때다.
  */
  useEffect(() => {
    if (pending || !justSentRef.current) return
    justSentRef.current = false
    document.getElementById(COMMENT_END_ID)?.scrollIntoView({
      block: 'end',
      behavior: 'smooth',
    })
  }, [pending])

  /** 커서 자리에 이모지를 끼워 넣는다. 끝에 붙이면 쓰던 글 중간에 못 넣는다. */
  const insertEmoji = (emoji: string) => {
    const input = inputRef.current
    const start = input?.selectionStart ?? text.length
    const end = input?.selectionEnd ?? text.length
    const next = `${text.slice(0, start)}${emoji}${text.slice(end)}`

    if (next.length > TEXT_MAX_LENGTH) {
      setError(`댓글은 ${TEXT_MAX_LENGTH}자까지 쓸 수 있어요.`)
      return
    }

    setText(next)
    setPickerOpen(false)
    setError(null)

    // 넣은 이모지 **뒤로** 커서를 옮긴다. 그리기가 끝난 뒤라야 자리가 잡힌다.
    requestAnimationFrame(() => {
      const caret = start + emoji.length
      input?.focus()
      input?.setSelectionRange(caret, caret)
    })
  }

  const sendText = () => {
    // 빈 값이면 아무 일도 하지 않는다. 안 쓴 채 누른 것은 실수이지 오류가 아니다.
    if (!text.trim() || pending) return

    const body = text
    setError(null)

    startTransition(async () => {
      const result = await createTextComment(memoryId, body)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // 보낸 뒤에만 비운다. 실패했는데 지워버리면 쓴 글을 잃는다.
      setText('')
      setPickerOpen(false)
      justSentRef.current = true
    })
  }

  /**
   * 음성 댓글을 서버에 넘긴다. **파일 올리기는 시트가 하고, 저장은 여기서 한다.**
   *
   * 왜 시트가 직접 부르지 않는가: 목록이 다시 그려진 뒤에 그 자리로 굴러가야 하는데,
   * 그 시점을 알려주는 것이 이 전환(pending)이다. 시트 안에서 따로 부르면
   * 전환 밖이라 언제 끝났는지 알 길이 없어 옛 목록 위에서 멈춘다.
   */
  const sendVoice = (
    voicePath: string,
    voiceDurationSec: number,
    voiceLevels: number[] | null,
  ) =>
    new Promise<CommentActionResult>((resolve) => {
      startTransition(async () => {
        const result = await createVoiceComment({
          memoryId,
          voicePath,
          voiceDurationSec,
          // 녹음하면서 이미 잰 값. 저장해 두면 목록이 파일을 안 받고도 파형을 그린다.
          voiceLevels,
        })
        if (result.ok) justSentRef.current = true
        resolve(result)
      })
    })

  return (
    <div className="shrink-0 border-t border-hairline bg-card">
      {error ? (
        <p
          role="alert"
          className="mx-auto w-full max-w-md px-4 pt-2 text-sm leading-relaxed text-primary"
        >
          {error}
        </p>
      ) : null}

      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-2.5">
        <div ref={emojiWrapRef} className="relative shrink-0">
          <button
            ref={emojiButtonRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={pickerOpen}
            aria-label="이모티콘 넣기"
            disabled={pending}
            onClick={() => {
              setError(null)
              setPickerOpen((was) => !was)
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-soft text-primary transition-[filter] active:brightness-95 disabled:opacity-60"
          >
            <SmileIcon />
          </button>

          {pickerOpen ? (
            <div
              role="menu"
              aria-label="이모티콘 선택"
              /*
                입력칸 위에 뜬다. left-0으로 왼쪽 끝을 맞춰야 좁은 화면 밖으로 나가지 않는다
                (버튼이 줄의 맨 왼쪽에 있다).

                w-max가 없으면 6칸이 한 줄로 무너진다. 자리를 잡아주는 부모(relative)가
                아이콘 버튼 하나 크기(≈47px)라, 그 안에 뜬 절대 위치 상자는 "쓸 수 있는 폭"을
                47px로 보고 거기에 맞춰 줄어든다. 실제로 그렇게 접혀 있었다.
              */
              className="absolute bottom-14 left-0 z-20 grid w-max grid-cols-6 gap-1 rounded-inner border border-hairline bg-card p-2.5 shadow-card"
            >
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji.char}
                  type="button"
                  role="menuitem"
                  aria-label={emoji.label}
                  onClick={() => insertEmoji(emoji.char)}
                  className="flex h-11 w-11 items-center justify-center rounded-inner-sm text-2xl transition-colors active:bg-primary-soft"
                >
                  {emoji.char}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <label htmlFor="comment-input" className="sr-only">
          댓글 남기기
        </label>
        <input
          id="comment-input"
          ref={inputRef}
          value={text}
          maxLength={TEXT_MAX_LENGTH}
          disabled={pending}
          placeholder="메시지 또는 음성메시지를 남겨보세요"
          onChange={(event) => {
            setText(event.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(event) => {
            // Enter로 보낸다(캡처 25). 조합 중(한글 입력)에 눌린 Enter는 글자를 확정하는
            // 것이지 보내라는 뜻이 아니다 — 막지 않으면 "안녕"이 "안"에서 끊겨 나간다.
            if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
              return
            }
            event.preventDefault()
            sendText()
          }}
          className="min-h-[44px] min-w-0 flex-1 rounded-chip bg-surface-soft px-4 text-base text-ink outline-none placeholder:text-muted disabled:opacity-60"
        />

        <button
          type="button"
          aria-label="음성 댓글 남기기"
          disabled={pending}
          onClick={() => {
            setError(null)
            setPickerOpen(false)
            setSheetOpen(true)
          }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-soft text-primary transition-[filter] active:brightness-95 disabled:opacity-60"
        >
          <MicIcon />
        </button>

        <button
          type="button"
          aria-label="댓글 보내기"
          // 쓴 글이 없으면 잠근다. 보이는 것도 흐려져 "지금은 누를 수 없다"가 드러난다.
          disabled={pending || !text.trim()}
          onClick={sendText}
          className="btn-primary-surface flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-60"
        >
          <SendIcon />
        </button>
      </div>

      {sheetOpen ? (
        <VoiceCommentSheet
          roomId={roomId}
          onClose={() => setSheetOpen(false)}
          onSubmit={sendVoice}
          // 목록이 다시 그려진 뒤 그 자리로 굴러가는 것은 위 effect가 맡는다.
          onSent={() => setSheetOpen(false)}
        />
      ) : null}
    </div>
  )
}

/**
 * 음성 댓글 시트 (캡처 26~33).
 *
 * 녹음기는 마음 표현하기와 **같은 부품**(VoiceRecorder)이다. 마이크 하나로 시작·정지,
 * 흘러가는 시간, 3초 미만이면 저장하지 않고 처음으로 되돌리기, 다 되면 미리듣기까지
 * 이미 그 안에 있다. 여기서 다시 짜면 두 화면의 녹음 규칙이 서서히 어긋난다.
 *
 * 이 시트가 맡는 것은 그 뒤다: 파일 올리기 → 서버에 경로 넘기기 → 실패하면 뒷정리.
 */
function VoiceCommentSheet({
  roomId,
  onClose,
  onSubmit,
  onSent,
}: {
  roomId: string
  onClose: () => void
  /** 올라간 파일의 경로를 서버에 넘긴다. 저장은 부모의 전환 안에서 일어난다. */
  onSubmit: (
    voicePath: string,
    voiceDurationSec: number,
    voiceLevels: number[] | null,
  ) => Promise<CommentActionResult>
  onSent: () => void
}) {
  const [recording, setRecording] = useState<VoiceRecording | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // <dialog>+showModal이라 초점 가두기·Esc로 닫기·뒤 화면 잠금이 브라우저에 들어 있다.
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  const submit = async () => {
    if (!recording || busy) return

    setBusy(true)
    setError(null)

    // 경로 첫 조각이 room_id여야 Storage RLS(is_room_member)를 통과한다.
    const path = `${roomId}/${randomFileId()}.${recording.extension}`
    const supabase = createClient()

    try {
      for (let attempt = 0; ; attempt += 1) {
        const { error: uploadError } = await supabase.storage
          .from(VOICE_BUCKET)
          .upload(path, recording.blob, {
            contentType: recording.mimeType,
            upsert: true,
          })

        if (!uploadError) break
        if (attempt === RETRY_DELAYS_MS.length) {
          throw new Error(`upload-failed: ${uploadError.message}`)
        }
        setError('연결이 잠시 불안정해요. 다시 보내볼게요.')
        await wait(RETRY_DELAYS_MS[attempt])
      }

      const result = await onSubmit(path, recording.durationSec, recording.levels)

      if (!result.ok) {
        /*
          저장에 실패했으면 방금 올린 파일은 아무 댓글도 가리키지 않는다.
          지울 수 있는 사람은 올린 본인(= 이 브라우저)뿐이라(Storage 삭제 정책은
          owner_id = auth.uid()) 이 자리를 놓치면 버킷에 영영 남는다.

          residue-scan-allow: physical-delete — 남의 기록이 아니라 **저장되지 못한
          내 업로드**를 되돌리는 것이다(compose-form의 discardUploads와 같은 판단).
        */
        console.warn('[음성 댓글] 저장되지 못한 파일을 정리합니다:', path)
        const { error: removeError } = await supabase.storage
          .from(VOICE_BUCKET)
          .remove([path])
        if (removeError) {
          console.error(
            '[음성 댓글] 정리 실패 — 남은 파일:',
            path,
            removeError.message,
          )
        }
        setError(result.error)
        setBusy(false)
        return
      }

      onSent()
    } catch (unexpected) {
      console.error('[음성 댓글] 올리기 실패:', unexpected)
      setError('녹음을 보내지 못했어요. 잠시 후 다시 눌러주세요.')
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="voice-comment-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
      /*
        아래에서 올라오는 시트 (캡처 26). m-0 + mt-auto 로 화면 아래에 붙인다 —
        <dialog>의 기본 margin:auto를 그대로 두면 화면 한가운데에 뜬다.
      */
      className="m-0 mt-auto w-full max-w-md rounded-t-card bg-canvas p-5 pb-6 text-ink shadow-card backdrop:bg-black/45 sm:mx-auto"
    >
      <h2 id="voice-comment-title" className="text-lg font-bold text-ink">
        음성 댓글 남기기
      </h2>
      <p className="mt-1 mb-4 text-base leading-relaxed break-keep text-muted">
        마이크를 눌러 녹음하고, {VOICE_MIN_SEC}초를 넘기면 등록할 수 있어요.
      </p>

      <VoiceRecorder
        value={recording}
        onChange={setRecording}
        disabled={busy}
      />

      {error ? (
        <p role="alert" className="mt-3 text-base leading-relaxed text-primary">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={busy}
          onClick={onClose}
        >
          취소
        </Button>
        {/* 3초를 못 넘겼으면 녹음이 아예 남지 않으므로 이 버튼은 잠긴 채다(캡처 27). */}
        <Button
          type="button"
          fullWidth
          disabled={!recording}
          pending={busy}
          pendingText="올리는 중…"
          onClick={() => void submit()}
        >
          댓글 등록
        </Button>
      </div>
    </dialog>
  )
}

/** 이모지 넣기 (프로토타입의 #i-smile). */
function SmileIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  )
}

function MicIcon() {
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
      <rect x="9" y="2.6" width="6" height="11.4" rx="3" fill="currentColor" stroke="none" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.2" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 11.5 20 4l-7.5 16-2-6.5z" />
    </svg>
  )
}
