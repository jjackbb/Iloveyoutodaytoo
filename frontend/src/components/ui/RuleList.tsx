/**
 * 입력 규칙을 **살아 있는 체크 목록**으로 보여준다.
 *
 * 전에는 "2~10자로 적어주세요. 특수문자는 쓸 수 없어요." 같은 한 줄이었다.
 * 읽고 나면 끝이라, 지금 내가 그 조건을 지켰는지는 **직접 세어봐야** 알 수 있었다.
 * 조건을 낱개로 쪼개서, 지킨 것은 색이 살아나고 체크가 켜지게 한다.
 *
 * ## 두 상태만 쓴다
 *
 * `비활성(회색·빈 동그라미)` / `활성(강조색·체크)` 둘뿐이다.
 * **아직 못 지킨 것을 빨갛게 만들지 않는다** — 두 글자 쳤을 때부터 빨간 글씨가 뜨면
 * 아직 적는 중인 사람을 혼내는 꼴이 된다. 못 지킨 것은 그냥 조용히 회색으로 있는다.
 * (제출한 뒤의 진짜 오류는 Field 의 `error` 가 따로 맡는다)
 *
 * ## 이 목록은 제출을 막지 않는다
 *
 * 안내일 뿐이고 실제 통과 여부는 서버가 정한다. 그래서 **여기 적는 조건은
 * 서버가 실제로 보는 것보다 느슨하면 안 된다** — 전부 체크됐는데 서버가 퇴짜를 놓으면
 * 사용자는 이유를 알 수 없다. 반대로 조금 엄격한 것은 괜찮다(권장 사항으로 읽힌다).
 */

export type Rule = {
  /** 조건 한 줄. "4~16자" 처럼 짧게. */
  label: string
  /** 지금 이 조건을 지켰는가. */
  met: boolean
}

export function RuleList({ id, rules }: { id?: string; rules: Rule[] }) {
  return (
    <ul id={id} className="flex flex-col gap-1.5">
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={[
            'flex items-center gap-2 text-base leading-relaxed transition-colors duration-150',
            rule.met ? 'font-medium text-primary' : 'text-muted',
          ].join(' ')}
        >
          <RuleMark met={rule.met} />
          {rule.label}
          {/*
            낭독기에는 색과 체크 모양이 안 보인다. 상태를 글로도 남긴다.
            aria-live 를 걸지 않는 이유: 한 글자 칠 때마다 읽어주면 시끄럽다.
          */}
          <span className="sr-only">{rule.met ? '— 충족' : '— 아직'}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * 조건 앞의 동그라미.
 * 지키기 전에는 빈 테두리, 지키면 강조색으로 차면서 흰 체크가 뜬다.
 * 크기가 두 상태에서 같아야 글자가 좌우로 흔들리지 않는다.
 */
function RuleMark({ met }: { met: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      aria-hidden
      className="shrink-0"
    >
      <circle
        cx="10"
        cy="10"
        r="9"
        className={
          met
            ? 'fill-primary stroke-primary'
            : 'fill-transparent stroke-hairline-strong'
        }
        strokeWidth="1.5"
      />
      {met ? (
        <path
          d="m6 10.3 2.7 2.7L14 7.7"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
}
