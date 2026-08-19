'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'

import { CommentMenu } from './comment-menu'
import { Button } from '@/components/ui/Button'
import { updateTextComment } from '@/lib/actions/comments'
import { TEXT_MAX_LENGTH } from '@/lib/limits'

/**
 * 텍스트 댓글의 말풍선 + ⋯ 메뉴 + 고치는 칸 (노션 IA 3.9).
 *
 * **왜 이 한 덩어리를 클라이언트로 묶었나**
 * ⋯ 메뉴에서 [수정]을 누르면 그 자리의 말풍선이 입력칸으로 바뀌어야 한다.
 * 둘이 같은 상태를 봐야 하므로 한 부품 안에 둔다. 목록 전체는 서버 컴포넌트로 남는다 —
 * 바뀌는 것은 눌린 댓글 하나뿐이다.
 *
 * 음성 댓글은 이 부품을 쓰지 않는다. 고칠 수 없기 때문이다(actions/comments.ts 설명 참고).
 *
 * 잔여데이터가 아닌 이유: 여기 담기는 것은 **고치는 동안의 초안**뿐이고,
 * 저장하면 서버가 다시 읽어 내려준 값으로 덮인다. 취소하면 원래 글로 되돌린다.
 */
export function CommentBody({
  commentId,
  body,
  edited,
  header,
}: {
  commentId: string
  body: string
  /** 한 번이라도 고친 댓글인가. 조용히 바뀌지 않았음을 보이는 표시다. */
  edited: boolean
  /**
   * 이름·시각 부분. 서버에서 그려 넘긴다.
   * ⋯ 메뉴는 이 부품이 직접 붙인다 — 메뉴와 입력칸이 같은 상태를 봐야 하기 때문이다.
   */
  header: ReactNode
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(body)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 고치기로 들어가면 칸 안에 커서를 두고 글 끝으로 보낸다.
  // 처음부터 커서가 앞에 있으면 이어 쓰려다 앞에 끼워 넣게 된다.
  useEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  function cancel() {
    setEditing(false)
    setDraft(body)
    setError(null)
  }

  function save() {
    startTransition(async () => {
      const result = await updateTextComment(commentId, draft)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEditing(false)
      setError(null)
      router.refresh()
    })
  }

  if (editing) {
    return (
      <>
        <div className="flex items-center gap-2">{header}</div>

        <div className="mt-1 flex flex-col gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          maxLength={TEXT_MAX_LENGTH}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Esc로 빠져나갈 수 있어야 한다. 취소 버튼까지 찾아가지 않아도 되게.
            if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            }
          }}
          aria-label="댓글 고치기"
          className="w-full rounded-inner border border-hairline-strong bg-card px-3.5 py-2.5 text-base leading-relaxed text-ink"
        />

        {error ? (
          <p role="alert" className="text-sm text-primary">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={save}
            pending={pending}
            pendingText="저장 중…"
          >
            저장
          </Button>
          <Button type="button" variant="secondary" onClick={cancel}>
            취소
          </Button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {header}
        <div className="ml-auto shrink-0">
          <CommentMenu
            commentId={commentId}
            isVoice={false}
            onEdit={() => setEditing(true)}
          />
        </div>
      </div>

      <p className="mt-1 inline-block rounded-inner rounded-tl-[4px] bg-surface-soft px-3.5 py-2.5 text-base leading-relaxed break-keep whitespace-pre-wrap text-ink">
        {body}
        {edited ? (
          // 고친 적이 있다는 표시. 가족이 주고받는 말이 아무 흔적 없이
          // 다른 말로 바뀌면 안 된다.
          <span className="ml-2 align-middle text-sm text-muted">수정됨</span>
        ) : null}
      </p>
    </>
  )
}
