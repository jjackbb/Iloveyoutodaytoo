/**
 * 마음 보내기 — "받는 사람" 후보의 모양과 이름표 규칙 (캡처 40~45).
 *
 * 여기에는 **타입과 순수 함수만** 둔다. DB도 브라우저 API도 부르지 않는다.
 * 그래야 서버(후보 만들기·대상 풀기)와 클라이언트(시트 그리기)가 같은 것을 보고 말한다.
 *
 * 후보는 네 갈래다(캡처 42의 목록 그대로):
 *   self   — "나에게"            : 나에게 보내는 마음
 *   random — "랜덤"              : 서버가 무작위로 한 사람을 고른다
 *   room   — "{방이름} (전체)"    : 그 방 멤버 전원에게 **각각** 한 통씩
 *   member — 개별 멤버
 *
 * 왜 id를 문자열 하나로 만드는가: 시트에서 고른 것을 서버로 넘길 때 객체를 통째로
 * 보내면 클라이언트가 방 id·사람 id를 마음대로 지어낼 수 있다. 문자열 id를 보내고
 * **서버가 다시 읽어 확인**하면, 화면은 "무엇을 골랐는지"만 말하고 판단은 서버가 한다.
 * (물론 마지막 방어선은 RLS다. 이건 그 앞단의 정직한 설계다.)
 */

import { nameMatchesQuery } from '@/lib/hangul'

/** 후보 한 줄. 시트 목록에도, 고른 사람 칩에도 이 값이 그대로 쓰인다. */
export type SendCandidate = {
  /** `self` · `random` · `room:{roomId}` · `member:{roomId}:{userId}` */
  id: string
  kind: 'self' | 'random' | 'room' | 'member'
  /** 굵게 나오는 이름. 방 후보는 "우리 가족 행복방 (전체)"처럼 접미가 붙어 있다. */
  name: string
  /** 이름 아래 회색 한 줄. "나에게 보내기", "전체 멤버 (3명)에게 보내기" 등. */
  description: string
  /** 서명된 프로필 사진(또는 방 커버) 주소. 없으면 기본 그림을 그린다. */
  avatarUrl: string | null
  /** 사진이 없는 방 후보에 깔 커버 그라데이션. 사람 후보는 항상 null이다. */
  coverGradient: string | null
}

/** 시트의 한 구역 (캡처 42의 "기본" / 방 이름 머리줄). */
export type SendCandidateGroup = {
  title: string
  items: SendCandidate[]
}

export type SendCandidates = {
  groups: SendCandidateGroup[]
  /** 불러오다 문제가 생겼을 때 화면에 그대로 보여줄 문구. 없으면 null. */
  error: string | null
}

/* ------------------------------------------------------------------ *
 * id 만들기 / 읽기
 * ------------------------------------------------------------------ */

export const SELF_CANDIDATE_ID = 'self'
export const RANDOM_CANDIDATE_ID = 'random'

export function roomCandidateId(roomId: string): string {
  return `room:${roomId}`
}

export function memberCandidateId(roomId: string, userId: string): string {
  return `member:${roomId}:${userId}`
}

/** 화면이 보내온 id를 뜯어 본다. 모양이 안 맞으면 null — 서버가 조용히 무시한다. */
export type ParsedCandidateId =
  | { kind: 'self' }
  | { kind: 'random' }
  | { kind: 'room'; roomId: string }
  | { kind: 'member'; roomId: string; userId: string }

export function parseCandidateId(raw: string): ParsedCandidateId | null {
  if (raw === SELF_CANDIDATE_ID) return { kind: 'self' }
  if (raw === RANDOM_CANDIDATE_ID) return { kind: 'random' }

  const parts = raw.split(':')
  if (parts[0] === 'room' && parts.length === 2 && parts[1]) {
    return { kind: 'room', roomId: parts[1] }
  }
  if (parts[0] === 'member' && parts.length === 3 && parts[1] && parts[2]) {
    return { kind: 'member', roomId: parts[1], userId: parts[2] }
  }
  return null
}

/* ------------------------------------------------------------------ *
 * 검색
 * ------------------------------------------------------------------ */

/**
 * 검색칸에 친 글자와 맞는 후보인지.
 *
 * 캡처의 안내 문구는 "이름(초성), 전화번호 검색"이지만 **전화번호로는 찾지 않는다.**
 * 여기 후보는 연락처가 아니라 이미 내 앨범방에 들어와 있는 분들이고,
 * 우리는 그분들의 전화번호를 가지고 있지 않다(가입에 번호가 필요 없다).
 * 없는 값으로 찾는 시늉을 하느니 이름으로만 찾고 안내 문구도 그렇게 적는다.
 */
export function candidateMatchesQuery(
  candidate: SendCandidate,
  query: string,
): boolean {
  if (!query.trim()) return true
  return (
    nameMatchesQuery(candidate.name, query) ||
    nameMatchesQuery(candidate.description, query)
  )
}
