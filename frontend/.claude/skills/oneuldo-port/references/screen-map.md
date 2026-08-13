# 프로토타입 화면 지도

> `extract-screen.mjs --list` 로 얻은 19개 화면과, 각각의 판정·함정.
> 판정의 최종 권한은 `_workspace/03_capture_flow.md`다 (2026-08-09 캡처 기준 전면 개정). 여기는 작업용 요약이다.
> **용어: 앨범방(관계방 아님)·멤버·추억. 관계유형 질문은 제거.**

## 파일 구성

| 줄 | 내용 | 이식 |
|---|---|---|
| 1 ~ 1,991 | `<style>` | 여백·모서리·그림자·배치만. **색·글자크기 제외** |
| 1,991 ~ 2,933 | 마크업 (화면 19개) | 구조까지 가져온다 |
| 2,933 ~ 6,957 | `<script>` 상태 기계 | **한 줄도 안 가져온다. 폐기 원인이다** |

## 화면 19개

| 화면 | 판정 | 지금 앱의 위치 | 함정 |
|---|---|---|---|
| `home` | 이식 | `src/app/page.tsx` | ⚠️ **body가 비어 있다** — `renderHome()`이 채운다 |
| `mailbox` | 이식 | `src/app/mailbox/` | 받은/보낸 탭 상태가 URL에 있어야 한다 |
| `my` | 이식 | `src/app/my/page.tsx` | 용량그래프·큰글자토글 **포함** (2026-08-09 캡처 기준) |
| `createRoom` | 이식 | `src/app/rooms/new/` | 커버 선택 UI 있음 |
| `invite` | 이식 | `src/app/rooms/[roomId]/invite/` | 링크·QR |
| `inviteContacts` | **이식 (재검토로 추가)** | 신규 | 연락처 API는 Android Chrome만. **수동 입력 대체 경로 필수**. 서버 SMS 발송 안 함 (`sms:` 딥링크) |
| `join` | 이식 | `src/app/invite/[token]/` | |
| `detail` | 이식 | `src/app/rooms/[roomId]/` | ⚠️ **body가 비어 있다** — `renderDetail()`. 댓글바·이모지피커·좋아요 **포함** (2026-08-09 캡처 기준) |
| `sendVoice` | 이식 | `src/app/rooms/[roomId]/compose/` | 녹음은 클라이언트 컴포넌트 |
| `userInfo` | 이식 | `src/app/my/` 하위 | |
| `accountDeletePage` | 이식 | `src/app/my/withdraw/` | 탈퇴는 물리삭제가 **맞다** (처리방침) |
| `album` | **4단계로 분리** | — | ⚠️ body 비어 있음. 사진/영상 — 이번 범위 아님 |
| `upload` | **4단계로 분리** | — | 이번 범위 아님 |
| `galleryView` | **4단계로 분리** | — | 이번 범위 아님 |
| `editPost` | **4단계로 분리** | — | 이번 범위 아님 |
| `signup` | 참고만 | `src/app/signup/` | Phase 2에 소셜+휴대폰으로 재작성 |
| `phone` | **보류** | — | Phase 2 로그인 |
| `otp` | **보류** | — | Phase 2 로그인 |
| `profile` | **보류** | — | Phase 2 로그인 |

## body가 비어 있는 화면 (가장 큰 함정)

`home` `album` `detail` 세 개는 마크업의 `<div class="body" id="…"></div>`가 비어 있다.
**JS가 채운다.** 마크업만 보고 이식하면 껍데기만 있는 빈 화면이 나온다.

추출 스크립트가 이 경우를 감지해 렌더 함수(`renderHome` 등)를 함께 뽑고 명세 머리말에
표시한다. 그 함수에서 읽어낼 것은 **HTML 모양**뿐 — `state.…`와 DOM 조작은
"서버에서 읽을 데이터"로 번역한다.

## 작업 순서

```
1. 토큰 대조 (한 번)
2. home       ← body 비어 있음 주의
3. detail     ← body 비어 있음 주의, 댓글바 포함
4. mailbox
5. my         ← 용량그래프·큰글자토글 포함
6. invite + inviteContacts   ← 연락처는 신규 기능
7. 나머지 (createRoom, join, sendVoice, userInfo, accountDeletePage)
```

`home`과 `detail`을 먼저 하는 이유: 가장 어렵고(body 비어 있음) 부품이 가장 많이 나온다.
여기서 뽑힌 부품이 나머지 화면을 빠르게 만든다.

## 연락처 초대 (`inviteContacts`) — 신규 기능이라 따로 본다

재검토로 되살아난 유일한 기능이다. 구현 제약:

- **서버가 SMS를 발송하지 않는다.** 솔라피 가입·발신번호 사전등록(영업일 1~3일)이
  아직 안 끝났다. `sms:` 딥링크로 사용자의 문자 앱을 여는 방식은 그 의존성이 없다.
- **Contact Picker API는 Android Chrome만 지원한다.** iOS Safari는 안 된다.
  따라서 **수동 번호 입력 경로를 항상 함께 둔다** — 없으면 아이폰 사용자는 못 쓴다.
- **연락처를 저장하지 않는다.** 고른 그 자리에서만 쓰고 서버로 보내지 않는다.
  `src/content/legal/privacy.md`에 이 사실을 적어야 한다.
