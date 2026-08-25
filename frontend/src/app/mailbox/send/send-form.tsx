'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { CandidateAvatar, TargetPicker } from './target-picker'
import {
  VoiceRecorder,
  type VoiceRecording,
} from '@/components/message/VoiceRecorder'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { resolveHeartTargets, type HeartTarget } from '@/lib/actions/heart-send'
import { sendHeartMessage } from '@/lib/actions/messages'
import type { SendCandidate, SendCandidates } from '@/lib/heart-send'
import { HEART_PROMPTS, getWeeklyPromptIndex } from '@/lib/prompts'
import { createClient } from '@/lib/supabase/client'

/**
 * 마음 보내기 — 받는 사람 고르기 + 녹음 + 보내기 (캡처 40~45).
 *
 * 왜 음성만 받는가 (캡처에도 마이크 카드 하나뿐이다):
 * heart_messages는 한 통이 글이거나 음성이거나 **둘 중 하나**다(type 컬럼). 그래서
 * "글도 음성도" 담을 수 없고, 넣으려면 캡처에 없는 모드 전환 스위치가 생긴다.
 * 글로 남기는 길은 앨범방의 "마음 표현하기"(문구)에 이미 있다.
 * 판단 근거는 _workspace/11_mailbox_send_port.md에 적었다.
 *
 * 잔여데이터가 남지 않는 이유:
 * 고른 사람도 녹음도 전부 이 컴포넌트의 상태다. 화면을 떠나면 함께 사라진다.
 * **Storage도 마찬가지다** — 저장까지 가지 못한 업로드는 떠날 때 지운다(`discardUploads`).
 * 안 지우면 화면의 잔여는 사라져도 버킷에 파일만 남는다.
 *
 * 한 녹음을 여러 방에 보낼 때 파일을 방마다 하나씩 올리는 이유:
 * 음성 경로는 반드시 `{room_id}/파일명`으로 시작해야 한다. Storage RLS가 경로 첫 조각을
 * room_id로 읽어 그 방 멤버인지 확인하기 때문이다. 한 파일을 여러 방이 나눠 쓰면
 * 다른 방 사람은 영영 듣지 못한다. 같은 방 안의 여러 사람에게는 한 파일을 함께 쓴다.
 */

/** 최초 시도 뒤 기다렸다 다시 보내는 간격. 총 3번 시도한다(마음 표현하기와 같다). */
const RETRY_DELAYS_MS = [1500, 4000]

const VOICE_BUCKET = 'voice'

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

/**
 * 어느 마음에도 붙지 못한 채 남은 녹음 파일을 지운다.
 *
 * 파일은 `sendHeartMessage`보다 **먼저** 올라간다. 저장이 실패한 뒤 사용자가 화면을
 * 떠나면 그 파일은 어떤 heart_messages 행에도 걸리지 않은 채 버킷에 영영 남는다.
 * Storage 삭제 정책은 올린 본인만 지울 수 있어서, 이 자리를 놓치면 지울 사람이 없어진다.
 *
 * 실패해도 사용자를 막지 않는다 — 이미 떠난 화면의 뒷정리다.
 * 대신 **반드시 로그를 남긴다.** 경로가 남아 있어야 나중에 찾아 지울 수 있다.
 */
async function discardUploads(paths: string[]): Promise<void> {
  if (paths.length === 0) return

  console.warn('[마음 보내기] 저장되지 못한 녹음을 정리합니다:', paths)

  try {
    const { error } = await createClient().storage
      .from(VOICE_BUCKET)
      .remove(paths)
    if (error) {
      console.error('[마음 보내기] 정리 실패 — 남은 파일:', paths, error.message)
    }
  } catch (unexpected) {
    console.error('[마음 보내기] 정리 실패 — 남은 파일:', paths, unexpected)
  }
}

type Phase = 'editing' | 'sending' | 'retrying' | 'failed'

export function SendForm({ candidates }: { candidates: SendCandidates }) {
  const router = useRouter()

  const [selected, setSelected] = useState<SendCandidate[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [recording, setRecording] = useState<VoiceRecording | null>(null)
  const [phase, setPhase] = useState<Phase>('editing')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * 오늘의 질문. 이번 주(ISO 주차, KST) 고정 인덱스에서 시작하고,
   * [다른 질문 보기]는 이 화면 안에서만 그 자리를 넘긴다 — 다음에 다시 들어오면
   * 또 이번 주 시작 질문으로 돌아온다.
   */
  const [promptIndex, setPromptIndex] = useState(() => getWeeklyPromptIndex())
  /** 질문을 접었는지. 접으면 promptUsed는 null로 보낸다. */
  const [promptOpen, setPromptOpen] = useState(true)
  const currentPrompt = HEART_PROMPTS[promptIndex]

  /** 토스트를 다시 띄우려면 key가 바뀌어야 한다(Toast는 마운트될 때 한 번만 센다). */
  const [toast, setToast] = useState<{ key: number; message: string } | null>(
    null,
  )

  /** 방마다 이미 올려 둔 파일 경로. 재시도할 때 같은 파일을 또 올리지 않는다. */
  const uploadedByRoomRef = useRef(new Map<string, string>())
  /** 저장이 끝났는지. 끝났으면 올라간 파일은 마음의 것이라 건드리면 안 된다. */
  const committedRef = useRef(false)

  const busy = phase === 'sending' || phase === 'retrying'
  const canSubmit = selected.length > 0 && recording !== null

  // 화면을 떠날 때, 아직 어떤 마음에도 붙지 못한 업로드를 지운다.
  useEffect(() => {
    const uploaded = uploadedByRoomRef.current
    const committed = committedRef

    return () => {
      if (committed.current) return
      void discardUploads([...uploaded.values()])
      uploaded.clear()
    }
  }, [])

  /**
   * 녹음이 바뀌면 앞서 올려 둔 경로는 반드시 버린다.
   * 안 버리면 "다시 녹음하기" 후 보냈을 때 **예전 녹음이 그대로 저장된다.**
   */
  const handleRecordingChange = useCallback((next: VoiceRecording | null) => {
    const stale = [...uploadedByRoomRef.current.values()]
    uploadedByRoomRef.current.clear()
    if (stale.length > 0) void discardUploads(stale)
    setRecording(next)
  }, [])

  /** [다른 질문 보기] — 목록을 한 칸 돌린다. 끝까지 가면 다시 처음으로. */
  const handleNextPrompt = useCallback(() => {
    setPromptIndex((current) => (current + 1) % HEART_PROMPTS.length)
  }, [])

  function handleConfirm(picked: SendCandidate[]) {
    setSelected(picked)
    setPickerOpen(false)
    setError(null)
    if (picked.length > 0) {
      // 캡처 44의 알약 문구 그대로.
      setToast({
        key: Date.now(),
        message: `${picked.length}명의 대화상대를 지정했습니다`,
      })
    }
  }

  /** Storage에 한 파일 올리기. 실패하면 잠시 기다렸다 자동으로 다시 시도한다. */
  const upload = useCallback(
    async (path: string, blob: Blob, contentType: string): Promise<void> => {
      const supabase = createClient()

      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        const { error: uploadError } = await supabase.storage
          .from(VOICE_BUCKET)
          .upload(path, blob, { contentType, upsert: true })

        if (!uploadError) return

        if (attempt === RETRY_DELAYS_MS.length) {
          throw new Error(`upload-failed: ${uploadError.message}`)
        }

        setPhase('retrying')
        setNotice('연결이 잠시 불안정해요. 잠시 후 자동으로 다시 보낼게요.')
        await wait(RETRY_DELAYS_MS[attempt])
      }
    },
    [],
  )

  const submit = useCallback(async () => {
    if (!canSubmit || busy || !recording) return

    setError(null)
    setNotice(null)
    setPhase('sending')

    try {
      // 1) 고른 것을 지금 DB 기준으로 푼다. "전체"가 몇 명인지, "랜덤"이 누구인지는
      //    화면이 아니라 서버가 정한다.
      const plan = await resolveHeartTargets(selected.map((item) => item.id))
      if (!plan.ok) {
        setPhase('failed')
        setError(plan.error)
        return
      }

      // 2) 방마다 녹음을 한 번씩 올린다(경로 첫 조각이 room_id여야 한다).
      const rooms = [...new Set(plan.targets.map((target) => target.roomId))]
      for (const roomId of rooms) {
        if (uploadedByRoomRef.current.has(roomId)) continue
        const path = `${roomId}/${randomFileId()}.${recording.extension}`
        await upload(path, recording.blob, recording.mimeType)
        uploadedByRoomRef.current.set(roomId, path)
      }

      // 3) 한 분에게 한 통씩. 이미 검증된 sendHeartMessage를 그대로 여러 번 부른다.
      const failed: HeartTarget[] = []
      let sent = 0

      for (const target of plan.targets) {
        const path = uploadedByRoomRef.current.get(target.roomId)
        if (!path) {
          failed.push(target)
          continue
        }

        const result = await sendHeartMessage({
          roomId: target.roomId,
          receiverId: target.receiverId,
          type: 'voice',
          content: path,
          durationSec: recording.durationSec,
          // 녹음하면서 이미 잰 값. 저장해 두면 사서함이 파일을 안 받고도 파형을 그린다.
          voiceLevels: recording.levels,
          sendMode: target.sendMode,
          // 질문을 접은 채로 보냈으면 null — "질문 없이 썼다"는 사실 그대로 남긴다.
          promptUsed: promptOpen ? currentPrompt : null,
        })

        // 한 분이 안 됐다고 나머지를 멈추지 않는다 — 그 사이 방을 나간 분이 있을 수 있다.
        if (result.ok) sent += 1
        else failed.push(target)
      }

      if (sent === 0) {
        setPhase('failed')
        setError(
          '지금은 보내지 못했어요. 녹음은 그대로 있으니 잠시 후 다시 눌러주세요.',
        )
        return
      }

      // 한 통이라도 저장됐으면 올라간 파일은 그 마음의 것이다. 떠날 때 지우면 안 된다.
      committedRef.current = true

      if (failed.length > 0) {
        // 일부만 갔다. 화면에 남아 누구에게 못 갔는지 알려준다(초대하기와 같은 방식).
        setPhase('failed')
        setNotice(null)
        setError(
          `${sent}명에게는 보냈어요. ${failed
            .map((target) => target.name)
            .join(', ')}님에게는 보내지 못했어요 — 그 사이 앨범방을 떠나셨을 수 있어요.`,
        )
        return
      }

      // 사서함의 "보낸 마음"으로 돌아간다. 방금 보낸 것이 맨 위에 보인다(캡처 46).
      router.replace(`/mailbox?box=sent&sent=${sent}`)
      router.refresh()
    } catch (submitError) {
      console.error('[마음 보내기] 실패:', submitError)
      setNotice(null)
      setError(
        '지금은 보내지 못했어요. 녹음은 그대로 있으니 잠시 후 다시 눌러주세요.',
      )
      setPhase('failed')
    }
  }, [busy, canSubmit, currentPrompt, promptOpen, recording, router, selected, upload])

  return (
    // 캡처 40처럼 [보내기]가 화면 아래에 고정된다 — 스크롤 칸 + 고정 줄 2단이다.
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-screen-x pt-2 pb-screen-b">
          {/* 받는 사람 (캡처 40·44) */}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-ink">받는 사람</h2>

            {candidates.error ? (
              <p
                role="alert"
                className="rounded-inner bg-primary-soft px-4 py-3 text-base leading-relaxed text-primary"
              >
                {candidates.error}
              </p>
            ) : (
              <ul className="flex gap-4 overflow-x-auto pb-1">
                <li className="shrink-0">
                  {/* [+ 추가하기] — 점선 원 + 글자 (캡처 40) */}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    disabled={busy}
                    className="flex min-h-[44px] items-center gap-3 rounded-inner pr-3 text-left active:bg-surface-soft disabled:opacity-60"
                  >
                    <span
                      aria-hidden
                      className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-hairline-strong text-muted"
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </span>
                    <span className="text-lg font-bold text-ink">추가하기</span>
                  </button>
                </li>

                {selected.map((item) => (
                  <li key={item.id} className="shrink-0">
                    <div className="flex w-16 flex-col items-center gap-1">
                      <div className="relative">
                        <CandidateAvatar item={item} size="sm" />
                        <button
                          type="button"
                          onClick={() =>
                            setSelected((current) =>
                              current.filter((value) => value.id !== item.id),
                            )
                          }
                          disabled={busy}
                          aria-label={`${item.name} 빼기`}
                          className="absolute -top-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full text-ink"
                        >
                          <span
                            aria-hidden
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                              strokeLinecap="round"
                            >
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </span>
                        </button>
                      </div>
                      <span className="w-full truncate text-center text-base text-ink">
                        {item.name}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 메세지 녹음 (캡처 40·45) — 앨범방 작성 화면과 같은 녹음기를 그대로 쓴다. */}
          <section aria-labelledby="send-voice-label" className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2
                id="send-voice-label"
                className="text-base font-bold text-ink"
              >
                메세지 녹음
              </h2>
              {/*
                오늘의 질문을 접었다 폈다 한다 — 질문은 거들 뿐이라 강요하지 않는다.
                접어도 상태만 바뀔 뿐 index는 그대로라, 다시 펴면 보던 질문이 그대로 나온다.
              */}
              <button
                type="button"
                onClick={() => setPromptOpen((open) => !open)}
                disabled={busy}
                className="min-h-[44px] shrink-0 rounded-[8px] px-2 text-base text-muted underline active:bg-surface-soft disabled:opacity-60"
              >
                {promptOpen ? '질문 없이 쓰기' : '질문 보기'}
              </button>
            </div>

            {promptOpen ? (
              <div className="flex items-center gap-3 rounded-inner bg-surface-soft px-4 py-3">
                <p
                  aria-live="polite"
                  className="flex-1 text-base leading-relaxed break-keep text-ink"
                >
                  {currentPrompt}
                </p>
                <button
                  type="button"
                  onClick={handleNextPrompt}
                  disabled={busy}
                  className="min-h-[44px] shrink-0 rounded-[8px] px-2 text-base font-bold whitespace-nowrap text-primary active:bg-primary-soft disabled:opacity-60"
                >
                  다른 질문 보기
                </button>
              </div>
            ) : null}

            <VoiceRecorder
              value={recording}
              onChange={handleRecordingChange}
              disabled={busy}
            />
          </section>

          {/* 왜 아직 버튼이 안 켜지는지 말해준다. 잠가만 두면 고장으로 읽힌다. */}
          {!canSubmit ? (
            <p className="text-center text-base break-keep text-muted">
              받는 분을 고르고 목소리를 담으면 보낼 수 있어요
            </p>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="rounded-inner bg-surface-soft px-4 py-3 text-base leading-relaxed text-muted"
            >
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-inner bg-primary-soft px-4 py-3 text-base leading-relaxed text-primary"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {/* 아래 고정 줄 (캡처 40 흐림 / 캡처 45 또렷함). */}
      <div className="shrink-0 border-t border-hairline bg-card px-screen-x py-3">
        <div className="mx-auto w-full max-w-md">
          <Button
            onClick={submit}
            fullWidth
            disabled={!canSubmit}
            pending={busy}
            pendingText={phase === 'retrying' ? '다시 보내는 중…' : '보내는 중…'}
          >
            <SendIcon />
            {phase === 'failed' ? '다시 보내기' : '보내기'}
          </Button>
        </div>
      </div>

      {pickerOpen ? (
        <TargetPicker
          groups={candidates.groups}
          initialSelectedIds={selected.map((item) => item.id)}
          onClose={() => setPickerOpen(false)}
          onConfirm={handleConfirm}
        />
      ) : null}

      {toast ? (
        <Toast key={toast.key} message={toast.message} offsetClassName="bottom-24" />
      ) : null}
    </div>
  )
}

/** 보내기 버튼의 종이비행기 (캡처 40). */
function SendIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.5 3.5 2.5 10.5l7.5 3 3 7.5z" />
      <path d="M10 14 21.5 3.5" />
    </svg>
  )
}
