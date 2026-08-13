import type { Metadata } from 'next'
import Link from 'next/link'

import { TabScreen } from '@/components/layout/TabScreen'
import { BackButton } from '@/components/nav/BackButton'
import { requireUser } from '@/lib/auth'

export const metadata: Metadata = { title: '문의하기 · 오늘도 사랑해' }

/**
 * 문의하기 — 권리 행사와 문의를 받는 창구.
 *
 * 왜 이 화면이 필요한가:
 * 개인정보 처리방침 제10조가 열람·정정·삭제·처리정지 요구를 "마이 > 문의하기"로
 * 받는다고 적어두었다. 문서에만 있고 화면이 없으면 그 안내가 거짓말이 된다.
 * (초안은 "설정 > 문의하기"라고 적었지만 이 서비스에 '설정' 탭은 없다. 방침을 화면에 맞췄다.)
 *
 * 왜 폼이 아니라 메일인가:
 * 문의를 담아둘 테이블이 DB에 없고, 스키마는 임의로 바꾸지 않는 것이 이 프로젝트의 규칙이다.
 * 없는 저장소에 "접수되었습니다"라고 답하는 화면은 만들지 않는다. 대신 메일 앱을 열어
 * 제목과 본문을 미리 채워준다 — 무엇을 적어야 할지 몰라 멈추는 일을 줄인다.
 *
 * 지금 이메일 주소가 비어 있는 이유:
 * 아직 정해지지 않았다. 없는 주소를 지어내면 보낸 메일이 조용히 사라진다.
 * 그래서 주소가 없는 동안에는 메일 버튼을 만들지 않고, 준비 중임을 그대로 알린다.
 * 주소가 정해지면 아래 CONTACT_EMAIL 한 줄만 채우면 버튼이 살아난다.
 */

/**
 * 문의를 받을 이메일 주소.
 *
 * 아직 미정이라 빈 값이다. 채우기 전까지 화면은 "준비 중"으로 보인다.
 * 타입을 string으로 못 박아둔 이유: 빈 문자열 리터럴로 좁혀지면
 * 주소가 있을 때의 화면이 통째로 죽은 코드로 취급된다.
 */
const CONTACT_EMAIL: string = ''

/** 주소가 정해지기 전 화면에 그대로 보여줄 자리표시자. */
const CONTACT_EMAIL_PLACEHOLDER = '[ 문의 이메일 ]'

type Topic = {
  id: string
  /** 목록에 보이는 이름 */
  label: string
  /** 이 유형이 무엇인지 한 줄 설명 */
  help: string
  /** 메일 제목 */
  subject: string
  /** 메일 본문에 빈칸으로 넣어줄 항목. 화면의 "적어주실 내용"과 같은 출처다. */
  fields: string[]
}

/**
 * 문의 유형.
 *
 * 화면에 보이는 항목 목록과 메일 본문 템플릿이 같은 배열에서 나온다.
 * 따로 적어두면 한쪽만 고쳐져서 "적으라던 것"과 "메일에 담긴 것"이 어긋난다.
 */
const TOPICS: Topic[] = [
  {
    id: 'privacy',
    label: '개인정보 열람·정정·삭제 요청',
    help: '내 개인정보를 확인하거나 고치거나 지워달라고 요청할 수 있어요. 처리를 멈춰달라는 요청(처리정지)도 여기예요.',
    subject: '[오늘도 사랑해] 개인정보 열람·정정·삭제·처리정지 요청',
    fields: [
      '요청 종류 (열람 / 정정 / 삭제 / 처리정지 중 하나)',
      '가입할 때 적은 이름',
      // 이제 가입 때 이메일을 묻지 않는다. 적은 적 없는 것을 적으라고 하면
      // 권리 행사(열람·정정·삭제) 자체가 여기서 막힌다.
      '가입할 때 만든 아이디',
      '요청하시는 내용',
    ],
  },
  {
    id: 'service',
    label: '서비스 이용 문의',
    help: '화면이 잘 안 되거나, 쓰는 방법이 궁금할 때 물어보세요.',
    subject: '[오늘도 사랑해] 서비스 이용 문의',
    fields: [
      '어떤 화면에서 생긴 일인가요',
      '무엇을 하려다 생긴 일인가요',
      '화면에 보인 안내 문구가 있다면 그대로',
      '쓰고 계신 기기 (예: 아이폰, 갤럭시, 컴퓨터)',
    ],
  },
  {
    id: 'report',
    label: '신고',
    help: '마음 한마디를 신고할 때는 그 옆의 "신고" 버튼이 더 빨라요. 그 밖의 일이나, 신고한 뒤 더 알릴 내용이 있을 때 이곳을 써주세요.',
    subject: '[오늘도 사랑해] 신고',
    fields: [
      '신고하시는 대상 (어떤 분인지, 또는 어떤 마음 한마디인지)',
      '어떤 일이 있었나요',
      '언제 있었던 일인가요',
      '이미 앱에서 신고하셨다면 그 사실',
    ],
  },
  {
    id: 'etc',
    label: '기타',
    help: '위에 없는 이야기도 좋아요. 하고 싶은 말씀을 편하게 적어주세요.',
    subject: '[오늘도 사랑해] 문의',
    fields: ['하고 싶은 말씀', '연락받을 방법 (답장받을 이메일 주소 등)'],
  },
]

/**
 * 메일 앱을 여는 주소를 만든다.
 *
 * 제목과 본문은 반드시 encodeURIComponent로 감싼다. 줄바꿈이나 괄호가 그대로 들어가면
 * 메일 앱에 따라 본문이 잘리거나 아예 열리지 않는다.
 */
function mailtoHref(email: string, topic: Topic): string {
  const body = [
    '안녕하세요.',
    '',
    ...topic.fields.map((field) => `- ${field}: `),
    '',
    '(빈칸을 채워서 보내주세요. 빈칸 그대로 보내주셔도 괜찮아요.)',
  ].join('\n')

  return `mailto:${email}?subject=${encodeURIComponent(
    topic.subject,
  )}&body=${encodeURIComponent(body)}`
}

export default async function ContactPage() {
  await requireUser()

  const ready = CONTACT_EMAIL.length > 0

  return (
    <TabScreen
      title="문의하기"
      leading={<BackButton href="/my" label="마이로 돌아가기" compact />}
    >
      <p className="text-base leading-relaxed text-muted">
        궁금한 점이나 불편한 점을 메일로 보내주세요. 아래에서 문의 유형을 고르면
        제목과 적을 내용을 미리 채워드려요.
      </p>

      {/*
          주소가 아직 없다는 사실을 숨기지 않는다.
          "보내기"처럼 보이는 버튼을 눌렀는데 아무 데도 가지 않으면
          시니어 사용자에게는 고장 난 화면이 된다.
        */}
      <section
        aria-labelledby="contact-address"
        className="flex flex-col gap-2 rounded-[14px] bg-primary-soft px-5 py-5"
      >
        {/*
            글자색을 분홍(text-primary)이 아니라 먹색(text-ink)으로 둔 이유:

            처음 판단은 bg-primary-soft 가 #fdebf3 이던 때 나왔다 — 그 위의 #d50e68 은
            4.49:1 로 WCAG AA(4.5:1) 미달이었다. 이후 토큰이 #fef0f6 으로 밝아지면서
            4.65:1 이 되어 기준은 넘겼지만, 기준선 바로 위라 여유가 없다.
            그래서 먹색을 그대로 둔다. text-lg(19px)는 '큰 글자' 예외에도 들지 않는다.
            (같은 판단이 src/lib/legal.ts 의 자리표시자에도 적용돼 있다)
          */}
        <h2 id="contact-address" className="text-lg font-medium text-ink">
          문의 이메일 주소
        </h2>

        {ready ? (
          <p className="break-all text-lg text-ink">{CONTACT_EMAIL}</p>
        ) : (
          <>
            <p className="break-all text-lg text-ink">
              {CONTACT_EMAIL_PLACEHOLDER}
            </p>
            <p className="text-base leading-relaxed text-ink">
              문의 이메일 주소는 아직 준비 중이에요. 주소가 정해지면 이 화면에서
              바로 메일 앱이 열립니다. 그때까지는 아래 내용을 미리 적어두셨다가
              보내주시면 돼요.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="contact-topics" className="flex flex-col gap-4">
        <h2 id="contact-topics" className="text-lg font-medium text-ink">
          문의 유형
        </h2>

        <ul className="flex flex-col gap-4">
          {TOPICS.map((topic) => (
            <li
              key={topic.id}
              className="flex flex-col gap-3 rounded-[14px] border border-hairline px-5 py-5"
            >
              <h3 className="text-lg font-bold text-ink">{topic.label}</h3>

              <p className="text-base leading-relaxed text-muted">
                {topic.help}
              </p>

              <div className="flex flex-col gap-2">
                <p className="text-base font-medium text-ink">적어주실 내용</p>
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {topic.fields.map((field) => (
                    <li
                      key={field}
                      className="text-base leading-relaxed text-ink"
                    >
                      {field}
                    </li>
                  ))}
                </ul>
              </div>

              {ready ? (
                <a
                  href={mailtoHref(CONTACT_EMAIL, topic)}
                  className="inline-flex min-h-[52px] items-center justify-center rounded-[8px] bg-primary px-5 text-lg font-medium text-white active:bg-primary-active"
                >
                  메일로 문의하기
                </a>
              ) : (
                <p className="text-base leading-relaxed text-muted">
                  메일 제목: {topic.subject}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/*
          신고는 이미 앱 안에 있는 기능이다. 여기로만 안내하면 더 느린 길을 알려주는 셈이다.
          삭제 요구도 마찬가지 — 탈퇴 화면에서 직접 하실 수 있다.
        */}
      <section
        aria-labelledby="contact-shortcuts"
        className="flex flex-col gap-2"
      >
        <h2 id="contact-shortcuts" className="text-lg font-medium text-ink">
          바로 하실 수 있는 일
        </h2>

        <ul className="flex flex-col divide-y divide-hairline rounded-[14px] border border-hairline">
          <li>
            <Link
              href="/my/blocks"
              className="flex min-h-[52px] items-center justify-between gap-3 px-5 py-4 text-lg text-ink active:bg-surface-soft"
            >
              차단한 분 확인·해제
              <span aria-hidden className="text-muted">
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/legal/privacy"
              className="flex min-h-[52px] items-center justify-between gap-3 px-5 py-4 text-lg text-ink active:bg-surface-soft"
            >
              개인정보 처리방침 보기
              <span aria-hidden className="text-muted">
                ›
              </span>
            </Link>
          </li>
          <li>
            <Link
              href="/my/withdraw"
              className="flex min-h-[52px] items-center justify-between gap-3 px-5 py-4 text-lg text-ink active:bg-surface-soft"
            >
              회원 탈퇴 (계정 삭제)
              <span aria-hidden className="text-muted">
                ›
              </span>
            </Link>
          </li>
        </ul>

        <p className="text-base leading-relaxed text-muted">
          마음 한마디는 사서함과 관계방에 있는 &lsquo;신고&rsquo; 버튼으로 바로
          접수하실 수 있어요.
        </p>
      </section>
    </TabScreen>
  )
}
