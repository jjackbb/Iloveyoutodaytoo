import { COMMENT_END_ID } from './comment-anchor'
import { CommentBody } from './comment-body'
import { CommentMenu } from './comment-menu'
import { VoicePlayer } from '@/components/media/VoicePlayer'
import { formatRelativeTime } from '@/lib/format'
import type { MemoryCommentView } from '@/lib/room-feed'

/**
 * 댓글 목록 (캡처 33~36).
 *
 * 한 줄의 모양: 아바타(32px) + [이름 · 시간] 아래에 말풍선(텍스트) 또는 재생바(음성).
 * 오래된 것이 위, 새 댓글이 맨 아래에 붙는다.
 *
 * 서버 컴포넌트다. 누르는 잎(삭제 ⋯)만 클라이언트다.
 * 이름은 방별 별명 규칙(`roomMemberName`)을 이미 거쳐서 온다 — 여기서 다시 정하지 않는다.
 */
export function CommentList({ comments }: { comments: MemoryCommentView[] }) {
  if (comments.length === 0) {
    return (
      <>
        <p className="py-6 text-center text-base leading-relaxed break-keep text-muted">
          아직 댓글이 없어요.
          <br />첫 마음을 남겨보세요 🌷
        </p>
        <div id={COMMENT_END_ID} />
      </>
    )
  }

  return (
    <>
      <ul className="flex flex-col gap-4">
        {comments.map((comment) => (
          <CommentRow key={comment.commentId} comment={comment} />
        ))}
      </ul>
      {/*
        댓글을 남기면 이 자리로 굴러온다. 높이가 0이라 화면에 보이지 않지만,
        목록 끝을 가리키는 표적으로는 충분하다.
      */}
      <div id={COMMENT_END_ID} />
    </>
  )
}

function CommentRow({ comment }: { comment: MemoryCommentView }) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary"
      >
        {initial(comment.authorName)}
      </span>

      <div className="min-w-0 flex-1">
        {/*
          내 텍스트 댓글은 그 자리에서 고칠 수 있어야 해서(노션 IA 3.9) 머리줄까지
          한 부품(CommentBody)이 맡는다 — ⋯ 메뉴와 입력칸이 같은 상태를 봐야 한다.
          나머지(남의 댓글·음성 댓글)는 서버가 그대로 그린다.
        */}
        {comment.isMine && comment.body !== null ? (
          <CommentBody
            commentId={comment.commentId}
            body={comment.body}
            edited={comment.edited}
            header={<CommentHeader comment={comment} />}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CommentHeader comment={comment} />

              {/*
                내가 남긴 댓글에만 ⋯ 가 붙는다. 남의 댓글에서는 아예 그리지 않는다 —
                눌러도 안 되는 것을 회색으로 두면 "왜 안 되지" 하고 계속 누르게 된다.
              */}
              {comment.isMine ? (
                <div className="ml-auto shrink-0">
                  <CommentMenu
                    commentId={comment.commentId}
                    isVoice={comment.voiceDurationSec !== null}
                  />
                </div>
              ) : null}
            </div>

            {comment.body ? (
              <p className="mt-1 inline-block rounded-inner rounded-tl-[4px] bg-surface-soft px-3.5 py-2.5 text-base leading-relaxed break-keep whitespace-pre-wrap text-ink">
                {comment.body}
                {comment.edited ? (
                  <span className="ml-2 align-middle text-sm text-muted">
                    수정됨
                  </span>
                ) : null}
              </p>
            ) : null}
          </>
        )}

        {comment.body ? null : comment.voiceUrl && comment.voiceDurationSec ? (
          <div className="mt-1">
            <VoicePlayer
              src={comment.voiceUrl}
              durationSec={comment.voiceDurationSec}
              levels={comment.voiceLevels}
              label={`${comment.authorName}님의 음성 댓글`}
            />
          </div>
        ) : (
          // 경로는 있는데 주소를 만들지 못한 음성 댓글. 조용히 빈 자리로 두지 않는다.
          <p className="mt-1 text-sm text-muted">
            목소리를 불러오지 못했어요. 잠시 후 다시 열어주세요.
          </p>
        )}
      </div>
    </li>
  )
}

/** 아바타에 넣을 한 글자. MemoryCard·MemberStack과 같은 규칙. */
function initial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '·'
  return [...trimmed][0] ?? '·'
}

/** 댓글 머리줄 — 이름과 시각. 고치는 중에도 그대로 보여야 해서 따로 뺐다. */
function CommentHeader({ comment }: { comment: MemoryCommentView }) {
  return (
    <>
      <p className="min-w-0 truncate text-sm font-bold text-ink">
        {comment.authorName}
      </p>
      <p className="shrink-0 text-sm text-muted">
        {formatRelativeTime(comment.createdAt)}
      </p>
    </>
  )
}
