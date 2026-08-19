/**
 * 초대장 본문 — "누가 누구를 어느 방에 부르고 있고, 첫 마디는 무엇인가".
 *
 * **초대받은 사람이 실제로 보는 화면(`/invite/[token]`)과, 보내는 사람이 미리 보는 화면
 * (노션 IA 3.2)이 이 부품 하나를 같이 쓴다.** 미리보기를 따로 그리면 언제 한쪽만
 * 고쳐져도 아무도 모른다 — "미리 본 것과 다르게 갔다"는 미리보기가 없느니만 못하다.
 *
 * 상태도 데이터 조회도 없다. 값은 전부 props로 받는다.
 */
export function InviteLetter({
  inviterName,
  relationshipLabel,
  roomName,
  message,
}: {
  inviterName: string
  /** 초대하는 쪽이 적은 호칭. 예: "엄마" */
  relationshipLabel: string
  roomName: string
  /** 초대장을 여는 순간 가장 먼저 읽히는 첫 마디. */
  message: string
}) {
  return (
    <>
      <header className="flex flex-col gap-3 text-center">
        <p className="text-base text-muted">초대장이 도착했어요</p>
        <h1 className="text-2xl leading-snug font-bold text-ink">
          {inviterName}님이
          <br />
          {relationshipLabel}님을 ‘{roomName}’에 부르고 있어요
        </h1>
      </header>

      {/* 초대자가 남긴 첫 마디. 이 화면에서 가장 먼저 읽히도록 크게 둔다. */}
      <blockquote className="rounded-[14px] bg-primary-soft px-5 py-6 text-center text-lg leading-relaxed text-ink">
        “{message}”
      </blockquote>
    </>
  )
}
