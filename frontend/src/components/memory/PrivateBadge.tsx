/**
 * '나만 보기' 표시 (2026-09-28 사용자 결정).
 *
 * 저장하던 순간 앨범방에 혼자였던 추억은 작성자만 본다. 표시가 없으면 나중에 초대한 사람도
 * 봤을 거라고 오해하게 된다. 작성자에게만 이런 글이 보이므로 이 표시도 작성자만 본다.
 * 자물쇠 모양과 글자를 함께 둔다 — 모양만으로는 뜻을 알 수 없다.
 */
export function PrivateBadge() {
  return (
    <span className="ml-2 inline-flex h-[22px] items-center gap-1 rounded-chip bg-surface-soft px-2 align-middle text-[13px] font-semibold text-ink/75">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </svg>
      나만 보기
    </span>
  )
}
