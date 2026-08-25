/**
 * 몽실이 — 이 서비스의 캐릭터.
 *
 * "쑥스러워서 못 하는 말"을 대신 맡아주는 존재다. 화면에서 **색을 내는 건 몽실이와
 * 버튼뿐**이고 바탕은 조용히 있는다(globals.css 머리말 참고). 그래서 몽실이가 묻히면
 * 화면 전체가 무색이 된다 — 배경을 바꿀 때는 몽실이가 살아 있는지 먼저 본다.
 *
 * ## 모양을 이렇게 만든 이유
 *
 * 처음에는 같은 크기 원 3개를 가로로 나란히 얹었는데 **곰발바닥으로 보였다.** 원인이 셋이었다.
 *
 * 1. 뭉치 크기가 같고 한 줄로 서 있었다 → 크기를 제각각으로, 위아래로 흩어 얹었다
 * 2. 그라데이션이 **원마다 따로** 걸려서 뭉치가 각각 별개의 공으로 읽혔다
 *    → `gradientUnits="userSpaceOnUse"` 로 **덩어리 전체에 하나만** 건다. ⚠️ 이걸 빼면 다시 발가락이 된다.
 * 3. 가장자리가 칼같이 떨어졌다 → 같은 모양을 흐리게 깐 겹을 뒤에 둬서 보풀지게 했다
 *
 * 시안·비교는 `_workspace/mock/start-r3.html`, 색 후보는 `_workspace/mock/violet.html`.
 */

/** 솜뭉치 [cx, cy, r]. **크기가 제각각인 것이 핵심이다** — 고르게 만들면 발가락이 된다. */
const PUFFS: readonly (readonly [number, number, number])[] = [
  [119, 84, 48], [77, 93, 41], [162, 93, 38], [97, 116, 36], [143, 117, 34],
  [53, 108, 28], [187, 107, 26], [90, 51, 27], [125, 41, 30], [157, 54, 24],
  [55, 76, 23], [185, 76, 19], [104, 29, 15], [71, 126, 22], [171, 126, 21],
  [120, 132, 26],
]

type MongsilProps = {
  /**
   * 그라데이션·필터 id 앞에 붙는 꼬리표.
   * 한 화면에 몽실이가 둘 이상 나오면 **반드시 서로 다르게** 준다 —
   * 같으면 뒤에 그려진 쪽이 앞의 정의를 덮어써 색이 엉킨다.
   */
  uid?: string
  className?: string
}

export function Mongsil({ uid = 'mongsil', className }: MongsilProps) {
  const gradientId = `${uid}-body`
  const blurId = `${uid}-blur`

  const puffs = PUFFS.map(([cx, cy, r]) => (
    <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} />
  ))

  return (
    // 장식이다. 뜻은 옆의 글이 이미 말해주므로 낭독기에서는 숨긴다.
    <svg viewBox="0 0 240 190" aria-hidden className={className}>
      <defs>
        {/*
          ⚠️ userSpaceOnUse 를 지워선 안 된다.
          기본값(objectBoundingBox)이면 원 16개가 각자 그라데이션을 갖게 되어
          뭉치가 알알이 흩어져 보인다 — 그게 "곰발바닥"의 정체였다.
        */}
        <radialGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          cx="86"
          cy="44"
          r="196"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="32%" stopColor="#fdf0f7" />
          <stop offset="64%" stopColor="#f8d4e8" />
          <stop offset="100%" stopColor="#eda6cd" />
        </radialGradient>

        <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {/* 바닥 그림자 — 이게 없으면 떠 있지 않고 바닥에 붙은 것으로 읽힌다 */}
      <ellipse
        cx="120"
        cy="171"
        rx="62"
        ry="9"
        fill="#d50e68"
        opacity="0.14"
        filter={`url(#${blurId})`}
      />

      {/* 보풀 겹: 같은 뭉치를 흐리게 깔아 윤곽을 솜처럼 풀어준다 */}
      <g fill={`url(#${gradientId})`} filter={`url(#${blurId})`} opacity="0.7">
        {puffs}
      </g>
      {/* 본체 */}
      <g fill={`url(#${gradientId})`}>{puffs}</g>

      {/* 위쪽에서 빛이 든다 */}
      <ellipse
        cx="94"
        cy="52"
        rx="40"
        ry="21"
        fill="#ffffff"
        opacity="0.42"
        filter={`url(#${blurId})`}
      />

      {/* 얼굴. 볼(분홍)이 빠지면 온기가 같이 빠진다 — 색을 옮길 때도 볼은 남긴다. */}
      <ellipse cx="81" cy="109" rx="11" ry="6.6" fill="#f79cc4" opacity="0.62" />
      <ellipse cx="159" cy="109" rx="11" ry="6.6" fill="#f79cc4" opacity="0.62" />
      <circle cx="101" cy="92" r="6.4" fill="#b8286a" />
      <circle cx="139" cy="92" r="6.4" fill="#b8286a" />
      <circle cx="103.4" cy="89.5" r="2.3" fill="#ffffff" />
      <circle cx="141.4" cy="89.5" r="2.3" fill="#ffffff" />
      <path
        d="M110 104 q10 8.5 20 0"
        fill="none"
        stroke="#b8286a"
        strokeWidth={3.4}
        strokeLinecap="round"
      />
    </svg>
  )
}
