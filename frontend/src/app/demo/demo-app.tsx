'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { BrandMark } from '@/components/brand/BrandMark'
import { HandwritingPad } from '@/components/handwriting/HandwritingPad'
import { HandwritingPlayer } from '@/components/handwriting/HandwritingPlayer'
import { HandwritingView } from '@/components/handwriting/HandwritingView'
import { VoiceRecorder, type VoiceRecording } from '@/components/message/VoiceRecorder'
import { VideoPlayer } from '@/components/media/VideoPlayer'
import { VoicePlayer } from '@/components/media/VoicePlayer'
import { VideoPicker, type PickedVideo } from '@/components/memory/VideoPicker'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { type HandwritingDoc } from '@/lib/handwriting'
import { formatDuration } from '@/lib/format'
import { CAPTION_MAX_LENGTH, PHOTO_MAX_COUNT } from '@/lib/limits'
import { resizePhoto } from '@/lib/image'
import { formatVideoDuration, normalizeVideoMime } from '@/lib/video'
import { DEMO_PEOPLE, emptyDemoDraft, validateMemory, type DemoActor, type DemoDraft, type DemoMemory, type DemoSnapshot, type DemoVideo } from '@/lib/demo/model'
import { useDemo } from './demo-context'

const HOME = '/demo'
const ROOM = '/demo/rooms/family'
const LEAVE_WHILE_RECORDING = '녹음하는 중이에요.\n지금 나가면 녹음하던 목소리는 담기지 않아요. 나갈까요?'
/** 녹음 중 브라우저 뒤로 가기를 먼저 받기 위해 쌓아 두는 같은 주소의 기록 표시. */
const RECORDING_GUARD = '__demoRecordingGuard'
type Method = 'handwriting' | 'voice' | 'photo' | 'video'
const METHODS: { key: Method; title: string; detail: string }[] = [
  { key: 'handwriting', title: '손글씨', detail: '내 손길 그대로' },
  { key: 'voice', title: '목소리', detail: '짧은 한마디로 · 최대 1분' },
  { key: 'photo', title: '사진', detail: `오늘의 한 장으로 · ${PHOTO_MAX_COUNT}장까지` },
  { key: 'video', title: '영상', detail: '움직이는 순간 그대로 · 30초까지' },
]

function Icon({ name, filled = false }: { name: string; filled?: boolean }) {
  const paths: Record<string, ReactNode> = {
    back: <path d="m14 6-6 6 6 6" />,
    next: <path d="m9 6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    home: <><path d="m3 10 9-7 9 7M5 9v11h14V9" /><path d="M9 20v-7h6v7" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />,
    handwriting: <><path d="m15 4 5 5-11 11-6 1 1-6L15 4ZM12 7l5 5" /><path d="M4 20h16" /></>,
    voice: <><rect x="8" y="3" width="8" height="12" rx="4" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" /></>,
    photo: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" /><path d="m3 16 5-5 4 4 4-5 5 7" /></>,
    video: <><rect x="2" y="6" width="14" height="12" rx="3" /><path d="m16 10 6-3v10l-6-3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    reset: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /></>,
    newAlbum: <><rect x="7" y="7" width="14" height="14" rx="3" /><path d="M5.5 1.5v8M1.5 5.5h8" /></>,
    comment: <path d="M4.5 5.5h15v11h-9l-4 3.5v-3.5h-2z" />,
    play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
    more: <><circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none" /></>,
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name] ?? paths.heart}</svg>
}

/** 데모 앨범방에 속한 사람(가상). 홈 카드와 앨범방 머리에서 프로필로 보여준다. */
const ROOM_MEMBERS: DemoActor[] = ['parent', 'child']

/** 겹친 프로필. `max`명까지 보이고 나머지는 +숫자로 줄인다(2026-09-28 사용자 요청: 3명 이상이면 +숫자). */
function MemberStack({ max = 2, className = '' }: { max?: number; className?: string }) {
  const shown = ROOM_MEMBERS.length > max ? ROOM_MEMBERS.slice(0, max) : ROOM_MEMBERS
  const extra = ROOM_MEMBERS.length - shown.length
  return <span className={`demo-member-stack ${className}`} aria-hidden>
    {shown.map((actor) => <span key={actor} className={`demo-avatar ${actor === 'parent' ? 'demo-avatar-parent' : ''}`}>{DEMO_PEOPLE[actor].name.slice(0, 1)}</span>)}
    {extra > 0 ? <span className="demo-avatar demo-avatar-more">+{extra}</span> : null}
  </span>
}

function messageOf(cause: unknown) {
  return cause instanceof Error ? cause.message : '저장하지 못했어요. 다시 시도해주세요.'
}

function useBlobUrl(blob: Blob | null) {
  const [resource, setResource] = useState<{ blob: Blob; url: string } | null>(null)
  useEffect(() => {
    if (!blob) return
    let url: string | null = null
    const frame = requestAnimationFrame(() => {
      url = URL.createObjectURL(blob)
      setResource({ blob, url })
    })
    return () => { cancelAnimationFrame(frame); if (url) URL.revokeObjectURL(url) }
  }, [blob])
  return resource?.blob === blob ? resource.url : null
}

function Photo({ blob, alt }: { blob: Blob; alt: string }) {
  const url = useBlobUrl(blob)
  // Blob은 외부 이미지 서버가 최적화할 수 없다.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="demo-photo" src={url} alt={alt} /> : <div className="demo-photo-loading" role="status">사진을 여는 중…</div>
}

function Voice({ memory }: { memory: DemoMemory }) {
  const url = useBlobUrl(memory.voice?.blob ?? null)
  return memory.voice && url ? <VoicePlayer key={memory.id} src={url} durationSec={memory.voice.durationSec} levels={memory.voice.levels} label={`${DEMO_PEOPLE[memory.author].name}님의 목소리`} /> : null
}

function Video({ memory }: { memory: DemoMemory }) {
  const url = useBlobUrl(memory.video?.blob ?? null)
  return memory.video ? url ? <VideoPlayer src={url} label={`${DEMO_PEOPLE[memory.author].name}님이 남긴 영상`} /> : <div className="demo-photo-loading" role="status">영상을 여는 중…</div> : null
}

/**
 * 기존 앱의 영상 담기 부품을 그대로 쓴다. 초안은 화면을 오가도 남아야 하므로 파일(Blob)만 초안에 두고,
 * 미리보기 주소는 여기서 만들고 돌려준다. 부품에는 `blob: null`로 넘겨 부품이 이 주소를 지우지 않게 한다.
 */
function DemoVideoField({ video, onChange, disabled }: { video: DemoVideo | null; onChange: (next: DemoVideo | null) => void; disabled: boolean }) {
  const url = useBlobUrl(video?.blob ?? null)
  if (video && !url) return <div className="demo-photo-loading" role="status">영상을 여는 중…</div>
  const value: PickedVideo | null = video && url ? { blob: null, previewUrl: url, durationMs: video.durationMs, mime: normalizeVideoMime(video.blob.type) } : null
  return <VideoPicker value={value} disabled={disabled} onChange={(next) => {
    if (!next) { onChange(null); return }
    if (next.blob) onChange({ blob: next.blob, durationMs: next.durationMs })
    // 부품이 만든 미리보기 주소는 쓰지 않는다. 위의 주소를 쓴다.
    if (next.blob) URL.revokeObjectURL(next.previewUrl)
  }} />
}

function HandwritingPlayback({ memory }: { memory: DemoMemory }) {
  const blob = useMemo(() => memory.handwriting ? new Blob([JSON.stringify(memory.handwriting)], { type: 'application/json' }) : null, [memory.handwriting])
  const url = useBlobUrl(blob)
  return url ? <HandwritingPlayer key={url} src={url} label={`${DEMO_PEOPLE[memory.author].name}님의 손글씨`} autoPlay /> : null
}

/** 기록을 지우고 읽음 표시에서도 뺀다. 되돌릴 수 없다(앱의 완전 삭제와 같은 뜻). */
function withoutMemories(current: DemoSnapshot, ids: string[]): DemoSnapshot {
  return {
    ...current,
    memories: current.memories.filter((item) => !ids.includes(item.id)),
    seen: { child: current.seen.child.filter((id) => !ids.includes(id)), parent: current.seen.parent.filter((id) => !ids.includes(id)) },
  }
}

/** 이미 남긴 마음을 고칠 때의 첫 초안. 담긴 수단 중 첫 번째 탭을 연다. */
function draftFromMemory(memory: DemoMemory): DemoDraft {
  const voice = memory.voice
  return {
    method: memory.handwriting ? 'handwriting' : memory.photos.length ? 'photo' : memory.video ? 'video' : voice ? 'voice' : null,
    handwriting: memory.handwriting,
    recording: voice ? { ...voice, mimeType: voice.blob.type || 'audio/webm', extension: (voice.blob.type.split('/')[1] ?? 'webm').split(';')[0] } : null,
    photos: memory.photos.map((blob, index) => ({ id: `${memory.id}-photo-${index}`, blob })),
    video: memory.video ?? null,
    caption: memory.caption,
  }
}

/** 되돌릴 수 없는 일을 하기 전의 확인 창. 앱과 같이 화면을 잠그는 창(<dialog>)이다. */
function ConfirmDialog({ title, body, confirmLabel, pendingLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; pendingLabel: string; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return <dialog ref={ref} className="demo-dialog" aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel() }}>
    <h2>{title}</h2>
    <p>{body}</p>
    {error ? <p className="demo-error" role="alert">{error}</p> : null}
    <div className="demo-dialog-actions">
      <button type="button" className="demo-secondary" disabled={busy} onClick={onCancel}>그만두기</button>
      <button type="button" className="demo-primary" disabled={busy} onClick={async () => {
        setBusy(true)
        setError(null)
        try { await onConfirm() } catch (cause) { setError(messageOf(cause)); setBusy(false) }
      }}>{busy ? pendingLabel : confirmLabel}</button>
    </div>
  </dialog>
}

/** 내가 남긴 마음의 ⋯ 메뉴 — 수정·삭제(2026-09-28, 앱과 같은 동작). */
function MemoryMore({ memory, onDeleted }: { memory: DemoMemory; onDeleted: () => void }) {
  const { mutate } = useDemo()
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown) }
  }, [open])
  const name = DEMO_PEOPLE[memory.author].name
  return <div className="demo-more" ref={ref}>
    <button type="button" className="demo-more-button" aria-haspopup="menu" aria-expanded={open} aria-label={`${name}님의 마음 더보기`} onClick={() => setOpen((was) => !was)}><Icon name="more" /></button>
    {open ? <div className="demo-menu" role="menu" aria-label={`${name}님의 마음 더보기`}>
      <Link role="menuitem" href={`${ROOM}/memories/${memory.id}/edit`}>수정</Link>
      <button type="button" role="menuitem" className="is-danger" onClick={() => { setOpen(false); setConfirming(true) }}>삭제</button>
    </div> : null}
    {confirming ? <ConfirmDialog title="이 마음을 삭제할까요?" body="손글씨·목소리·사진·영상·한마디와 받은 반응이 모두 지워져요. 되돌릴 수 없어요." confirmLabel="삭제하기" pendingLabel="삭제하는 중…" onCancel={() => setConfirming(false)} onConfirm={async () => {
      await mutate((current) => withoutMemories(current, [memory.id]))
      setConfirming(false)
      onDeleted()
    }} /> : null}
  </div>
}

/** 좋아요(인스타그램처럼 하트 하나로 켜고 끈다). 카드와 상세가 같이 쓴다. 본인 마음에도 누를 수 있다(2026-09-25 결정). */
function LikeButton({ memory }: { memory: DemoMemory }) {
  const { data, mutate, readOnly } = useDemo()
  const [busy, setBusy] = useState(false)
  if (!data) return null
  const liked = memory.likedBy.includes(data.actor)
  return <button type="button" className={`demo-action${liked ? ' is-liked' : ''}`} aria-pressed={liked} aria-label={`좋아요 ${memory.likedBy.length}개`} disabled={busy || readOnly} onClick={async () => {
    setBusy(true)
    try {
      const actor = data.actor
      await mutate((current) => ({ ...current, memories: current.memories.map((item) => item.id !== memory.id ? item : { ...item, likedBy: item.likedBy.includes(actor) ? item.likedBy.filter((person) => person !== actor) : [...item.likedBy, actor] }) }))
    } finally { setBusy(false) }
  }}><Icon name="heart" filled={liked} /><span>{memory.likedBy.length}</span></button>
}

/** 영상의 첫 장면(재생 전). 소리·조작 없이 멈춰 있다. */
function VideoPoster({ memory }: { memory: DemoMemory }) {
  const url = useBlobUrl(memory.video?.blob ?? null)
  if (!memory.video) return null
  return <div className="demo-video-poster">
    {url ? <video src={url} muted playsInline preload="metadata" aria-hidden /> : null}
    <span className="demo-video-duration">영상 {formatVideoDuration(memory.video.durationMs)}</span>
  </div>
}

function VideoInlinePlayer({ memory }: { memory: DemoMemory }) {
  const url = useBlobUrl(memory.video?.blob ?? null)
  return <div className="demo-video-poster">{url ? <video src={url} controls autoPlay playsInline aria-label={`${DEMO_PEOPLE[memory.author].name}님이 남긴 영상`} /> : null}</div>
}

/**
 * 카드의 마음 표현(2026-09-28). 누르면 상세로 간다. 손글씨·영상은 오른쪽 위 ▶를 누르면
 * 상세로 가지 않고 그 자리에서 재생한다.
 */
function CardMedia({ memory, href }: { memory: DemoMemory; href: string }) {
  const [playing, setPlaying] = useState(false)
  const name = DEMO_PEOPLE[memory.author].name
  const playable = memory.handwriting ? 'handwriting' : !memory.photos.length && memory.video ? 'video' : null
  if (playing && playable === 'handwriting') return <div className="demo-handwriting-preview"><HandwritingPlayback memory={memory} /></div>
  if (playing && playable === 'video') return <VideoInlinePlayer memory={memory} />
  return <div className="demo-card-media">
    <Link href={href} className="demo-memory-preview" aria-label={`${name}님의 마음 열기`}>{playable === 'video' ? <VideoPoster memory={memory} /> : <PreviewMedia memory={memory} />}</Link>
    {playable ? <button type="button" className="demo-play" aria-label={`${name}님의 ${playable === 'handwriting' ? '손글씨' : '영상'} 재생`} onClick={() => setPlaying(true)}><Icon name="play" /></button> : null}
  </div>
}


export function DemoApp() {
  const pathname = usePathname()
  const router = useRouter()
  const { data, loading, error, readOnly, resettable, composeOrigin, mutate, reset } = useDemo()
  const [busy, setBusy] = useState(false)
  const [recording, setRecording] = useState(false)
  const leaving = useRef(false)
  const guardActive = useRef(false)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const composing = pathname === `${ROOM}/compose`
  const isHome = pathname === HOME
  const isRoom = pathname === ROOM
  const isRoomEdit = pathname === `${ROOM}/edit`
  // 이미 남긴 마음 고치기(2026-09-28): /demo/rooms/family/memories/{id}/edit
  const editingId = pathname.match(/^\/demo\/rooms\/family\/memories\/([^/]+)\/edit$/)?.[1] ?? null
  const writing = composing || editingId !== null
  const detailId = !editingId && pathname.startsWith(`${ROOM}/memories/`) ? pathname.slice(`${ROOM}/memories/`.length) : null
  const memory = data?.memories.find((item) => item.id === detailId)
  const editingMemory = data?.memories.find((item) => item.id === editingId)
  const hasMine = Boolean(data?.memories.some((item) => item.author === data.actor))
  // 작성은 들어온 화면(홈·앨범방)으로, 주소로 바로 들어왔다면 앨범방으로 돌아간다. 고치기는 그 마음으로 돌아간다.
  const backHref = composing ? (composeOrigin === HOME ? HOME : ROOM) : editingId ? `${ROOM}/memories/${editingId}` : isRoom ? HOME : ROOM
  const backLabel = backHref === HOME ? '홈으로 돌아가기' : editingId ? '마음으로 돌아가기' : '앨범방으로 돌아가기'

  const notify = useCallback((text: string) => setNotice({ id: Date.now(), text }), [])

  /*
    녹음 중 브라우저 뒤로 가기. 같은 주소의 기록을 하나 더 쌓아 두면 뒤로 가기가 먼저 그 기록을 꺼내므로
    화면을 떠나기 전에 물을 수 있다. 계속하면 기록을 다시 쌓고, 나가면 한 번 더 뒤로 간다.
    화면이 사라지면 녹음기가 진행 중인 녹음을 초안에 넘기지 않고 버린다.
  */
  useEffect(() => {
    if (!recording) return
    guardActive.current = true
    leaving.current = false
    let armed = true
    const arm = () => window.history.pushState({ [RECORDING_GUARD]: true }, '')
    if (!window.history.state?.[RECORDING_GUARD]) arm()
    const onPopState = () => {
      if (!armed) return
      if (window.confirm(LEAVE_WHILE_RECORDING)) {
        armed = false
        leaving.current = true
        window.history.back()
      } else arm()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      guardActive.current = false
      if (!armed || leaving.current) return
      // 녹음을 마치고 작성 화면에 머무르면 쌓아 둔 기록을 걷어, 뒤로 가기가 한 번에 되게 한다.
      // 개발 모드의 효과 재실행과 겹치지 않도록 한 박자 뒤에 확인한다.
      setTimeout(() => {
        if (!guardActive.current && window.history.state?.[RECORDING_GUARD]) window.history.back()
      }, 0)
    }
  }, [recording])

  /** 녹음 중 화면 안의 링크로 나갈 때 먼저 묻는다. 나가면 쌓아 둔 기록 자리를 목적지로 바꾼다. */
  function leaveWhileRecording(href: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!recording) return
      event.preventDefault()
      if (!window.confirm(LEAVE_WHILE_RECORDING)) return
      leaving.current = true
      if (window.history.state?.[RECORDING_GUARD]) router.replace(href)
      else router.push(href)
    }
  }

  async function changeActor(actor: DemoActor) {
    if (busy || writing) return
    setBusy(true)
    try {
      await mutate((current) => ({ ...current, actor }))
      notify(`${DEMO_PEOPLE[actor].name}의 시점으로 바꿨어요`)
    } catch (cause) { setFailure(messageOf(cause)) }
    finally { setBusy(false) }
  }

  async function startOver() {
    if (busy || !window.confirm('이 브라우저에서 체험하며 남긴 손글씨·목소리·사진·영상과 반응을 지우고, 처음의 예시로 돌아갈까요?')) return
    setBusy(true)
    try {
      await reset()
      setFailure(null)
      router.push(HOME)
      notify('처음의 예시로 돌아왔어요')
    } catch (cause) { setFailure(messageOf(cause)) }
    finally { setBusy(false) }
  }

  // 상세를 실제로 열었을 때만 그 인물의 읽음 상태를 바꾼다.
  useEffect(() => {
    if (!data || !memory || data.seen[data.actor].includes(memory.id) || readOnly) return
    const actor = data.actor
    void mutate((current) => ({
      ...current,
      seen: { ...current.seen, [actor]: [...new Set([...current.seen[actor], memory.id])] },
    })).catch((cause: unknown) => setFailure(messageOf(cause)))
  }, [data, memory, mutate, readOnly])

  return (
    <div className="demo-root">
      <div className="demo-toolbar">
        <div className="demo-toolbar-inner">
          <Link href={HOME} className="demo-label" onClick={leaveWhileRecording(HOME)}>포트폴리오 데모</Link>
          <div className="demo-tools">
            <label className="demo-actor-label">
              <span>보는 사람</span>
              <select aria-label="체험 인물" disabled={loading || busy || writing || readOnly} value={data?.actor ?? 'child'} onChange={(event) => void changeActor(event.target.value as DemoActor)}>
                <option value="child">지우 · 자녀</option>
                <option value="parent">엄마 · 부모</option>
              </select>
            </label>
            <button className="demo-reset" type="button" disabled={busy || writing} onClick={() => void startOver()} aria-label="데모 초기화"><Icon name="reset" /><span>초기화</span></button>
          </div>
        </div>
        {/* 체험 안내와 후기 설문 입구는 앱 화면 밖에 둔다. */}
        <div className="demo-toolbar-bottom">
          <p className="demo-toolbar-note">가상의 앨범방이에요. 내용은 이 브라우저에만 남아요. · 실제 전송 없이 체험하는 화면 · <Link href="/welcome">서비스 소개</Link></p>
          <Link className="demo-feedback-entry" href="/demo/feedback" onClick={leaveWhileRecording('/demo/feedback')}>데모 후기 설문 제출하기</Link>
        </div>
      </div>

      {/* 홈·작성은 아래 행동 버튼을 고정하고 내용만 스크롤한다(2026-09-28 대표 시안 A). */}
      <div className={`demo-phone${writing || isRoom || isRoomEdit || memory ? ' demo-phone--compose' : ''}`}>
        <header className="demo-appbar">
          {isHome ? <>
            <span className="demo-appbar-spacer" aria-hidden />
            <h1 className="demo-brand"><BrandMark size={22} />오늘도 사랑해</h1>
            {/* 새 앨범방 만들기(2026-09-28). 체험에는 앨범방 하나만 있어 만들지는 않고 알린다. */}
            <button type="button" className="demo-icon-button demo-new-album" aria-label="새 앨범방 만들기" onClick={() => notify('체험에서는 앨범방을 하나만 둘 수 있어요')}><Icon name="newAlbum" /></button>
          </> : <>
            <Link className="demo-icon-button" href={backHref} aria-label={backLabel} onClick={leaveWhileRecording(backHref)}><Icon name="back" /></Link>
            <h1>{composing ? '마음 남기기' : editingId ? '마음 고치기' : isRoomEdit ? '추억 고르기' : '우리 앨범방'}</h1>
            {/* 앨범방 편집(2026-09-28): 내 마음이 있을 때만 [편집], 편집 중에는 [완료]. */}
            {isRoom && hasMine && !readOnly ? <Link className="demo-text-button" href={`${ROOM}/edit`}>편집</Link> : isRoomEdit ? <Link className="demo-text-button is-primary" href={ROOM}>완료</Link> : <span className="demo-appbar-spacer" aria-hidden />}
          </>}
        </header>

        {failure || error ? <div className="demo-error" role="alert">{failure ?? error}{readOnly ? <p>{resettable ? '지금은 예시만 볼 수 있어요. 위의 초기화로 다시 시도할 수 있어요.' : '지금은 예시만 볼 수 있어요. 저장·반응은 이 브라우저에서 저장소를 열 수 있을 때 다시 쓸 수 있어요.'}</p> : null}</div> : null}

        {loading || !data ? <main className="demo-main"><p role="status">앨범방을 준비하고 있어요…</p></main> : isHome ? <Home /> : isRoom ? <Room onNotice={notify} /> : isRoomEdit ? <RoomEdit onNotice={notify} /> : composing ? <Compose key={data.actor} onSaved={notify} onRecordingChange={setRecording} /> : editingId ? (editingMemory ? editingMemory.author === data.actor ? <Compose key={editingMemory.id} editing={editingMemory} onSaved={notify} onRecordingChange={setRecording} /> : <main className="demo-main demo-empty"><h2>내가 남긴 마음만 고칠 수 있어요</h2><p>보는 사람을 바꿨다면 그 사람의 마음만 고칠 수 있어요.</p><Link className="demo-primary" href={`${ROOM}/memories/${editingMemory.id}`}>마음으로 돌아가기</Link></main> : <main className="demo-main demo-empty"><h2>이 마음을 찾지 못했어요</h2><p>예시를 초기화했거나 주소가 바뀌었을 수 있어요.</p><Link className="demo-primary" href={ROOM}>앨범방으로 돌아가기</Link></main>) : memory ? <Detail key={memory.id} memory={memory} onNotice={notify} /> : detailId ? <main className="demo-main demo-empty"><h2>이 마음을 찾지 못했어요</h2><p>예시를 초기화했거나 주소가 바뀌었을 수 있어요.</p><Link className="demo-primary" href={ROOM}>앨범방으로 돌아가기</Link></main> : <main className="demo-main demo-empty"><h2>이 화면을 찾지 못했어요</h2><p>주소가 바뀌었거나 체험에 없는 화면이에요.</p><Link className="demo-primary" href={ROOM}>앨범방으로 돌아가기</Link></main>}


      </div>
      {notice ? <Toast key={notice.id} message={notice.text} /> : null}
    </div>
  )
}

function Home() {
  const { data, mutate, readOnly } = useDemo()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!data) return null
  const unread = data.memories.filter((memory) => memory.author !== data.actor && !data.seen[data.actor].includes(memory.id)).length
  const recent = data.memories[0]

  // 홈은 앨범방 카드만 둔다(2026-09-28 사용자 요청: 인사·안내·아래 버튼 제거).
  return <main className="demo-main demo-home">
    <section aria-label="나의 앨범방">
      <article className="demo-album">
        <Link className="demo-album-link" href={ROOM} aria-label={`우리 앨범방 열기, 함께하는 사람 ${ROOM_MEMBERS.map((actor) => DEMO_PEOPLE[actor].name).join('·')}${unread ? `, 새 마음 ${unread}개` : ''}`}>
          <div className="demo-cover-art" aria-hidden>{recent?.handwriting ? <HandwritingView doc={recent.handwriting} label="" /> : <BrandMark size={64} />}</div>
          <MemberStack className="demo-album-members" />
          <span className="demo-album-name">우리 앨범방{unread > 0 ? <span className="demo-unread" aria-hidden>{unread > 99 ? '99+' : unread}</span> : null}</span>
        </Link>
        <button type="button" className={`demo-album-favorite${data.favorite[data.actor] ? ' is-favorite' : ''}`} aria-label="우리 앨범방 즐겨찾기" aria-pressed={data.favorite[data.actor]} disabled={busy || readOnly} onClick={async () => {
          setBusy(true)
          try { await mutate((current) => ({ ...current, favorite: { ...current.favorite, [data.actor]: !current.favorite[data.actor] } })) }
          catch (cause) { setError(messageOf(cause)) }
          finally { setBusy(false) }
        }}><Icon name="heart" filled={data.favorite[data.actor]} /></button>
      </article>
    </section>
    {error ? <p className="demo-error" role="alert">{error}</p> : null}
  </main>
}

/** 목록 카드의 미디어 미리보기 한 칸. 앨범방과 편집 화면이 같이 쓴다. */
function PreviewMedia({ memory }: { memory: DemoMemory }) {
  const name = DEMO_PEOPLE[memory.author].name
  return memory.handwriting ? <div className="demo-handwriting-preview"><HandwritingView doc={memory.handwriting} label={`${name}님의 손글씨`} /></div> : memory.photos[0] ? <Photo blob={memory.photos[0]} alt="남긴 추억의 첫 사진" /> : memory.video ? <div className="demo-voice-preview"><Icon name="video" /><span>영상 {formatVideoDuration(memory.video.durationMs)}</span><span>보기</span></div> : <div className="demo-voice-preview"><Icon name="voice" /><span>목소리 {formatDuration(memory.voice?.durationSec)}</span><span>들어보기</span></div>
}

function memoryDate(memory: DemoMemory) {
  return memory.example ? '체험용 예시' : new Date(memory.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function Room({ onNotice }: { onNotice: (message: string) => void }) {
  const { data, readOnly } = useDemo()
  if (!data) return null
  return <main className="demo-main demo-compose demo-room">
    <div className="demo-compose-fields">
    <section className="demo-room-heading">
      {/* 이 앨범방의 사람 프로필만 나열한다(2026-09-28). */}
      <span className="demo-room-members" role="img" aria-label={`함께하는 사람 ${ROOM_MEMBERS.map((actor) => DEMO_PEOPLE[actor].name).join('·')}`}>{ROOM_MEMBERS.map((actor) => <span key={actor} className={`demo-avatar ${actor === 'parent' ? 'demo-avatar-parent' : ''}`} aria-hidden>{DEMO_PEOPLE[actor].name.slice(0, 1)}</span>)}</span>
      <h2>함께 남긴 순간들</h2>
    </section>
    <div className="demo-section-heading"><h3>남겨진 마음</h3><span>{data.memories.length}</span></div>
    {data.memories.length ? <ul className="demo-feed">{data.memories.map((memory) => {
      const mine = memory.author === data.actor && !readOnly
      const href = `${ROOM}/memories/${memory.id}`
      const commentCount = memory.comments?.length ?? 0
      return <li key={memory.id}><div className="demo-feed-item">
        {/* 작성자 줄은 누르는 자리가 아니다. 마음 표현과 문구를 누르면 상세로 간다(2026-09-28). */}
        <div className="demo-author"><span className={`demo-avatar ${memory.author === 'parent' ? 'demo-avatar-parent' : ''}`}>{DEMO_PEOPLE[memory.author].name.slice(0, 1)}</span><div><strong>{DEMO_PEOPLE[memory.author].name}</strong><p>{memoryDate(memory)}</p></div></div>
        <CardMedia memory={memory} href={href} />
        {memory.caption ? <Link href={href} className="demo-memory-preview"><p className="demo-caption-preview">{memory.caption}</p></Link> : null}
        {/* 왼쪽 아래 좋아요·댓글 수(2026-09-28, 인스타그램처럼). */}
        <div className="demo-card-actions">
          <LikeButton memory={memory} />
          <Link href={`${href}#comments`} className="demo-action" aria-label={`댓글 ${commentCount}개 보기`}><Icon name="comment" /><span>{commentCount}</span></Link>
        </div>
        {/* 내 마음에만 ⋯(수정·삭제). 링크 안에 버튼을 넣을 수 없어 카드 위에 겹쳐 둔다. */}
        {mine ? <MemoryMore memory={memory} onDeleted={() => onNotice('마음을 삭제했어요')} /> : null}
      </div></li>
    })}</ul> : <div className="demo-empty"><h3>아직 남겨진 마음이 없어요</h3><p>오른쪽 아래 + 로 첫 기록을 담아보세요.</p></div>}
    </div>
    {/* 스크롤해도 오른쪽 아래에 떠 있는 마음 남기기(2026-09-28). */}
    <Link className="demo-fab" href={`${ROOM}/compose`} aria-label="마음 남기기"><Icon name="plus" /></Link>
  </main>
}

/**
 * 앨범방 편집(2026-09-28 사용자 결정, 앱과 같은 동작). 내 마음만 여러 개 골라 수정(한 개일 때)·삭제한다.
 * 데모는 늘 두 사람이 함께 있어 '나만 보기'가 생기지 않으므로 [공개로 바꾸기]는 없다.
 */
function RoomEdit({ onNotice }: { onNotice: (message: string) => void }) {
  const { data, mutate, readOnly } = useDemo()
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  if (!data) return null
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const single = selected.length === 1 ? selected[0] : null
  return <main className="demo-main demo-compose demo-room-edit">
    <div className="demo-compose-fields">
      <p className="demo-edit-hint">내가 남긴 마음만 고를 수 있어요.</p>
      {data.memories.length ? <ul className="demo-feed">{data.memories.map((memory) => {
        const name = DEMO_PEOPLE[memory.author].name
        const mine = memory.author === data.actor
        const isSelected = selected.includes(memory.id)
        const body = <>
          <span className="demo-author">{mine ? <span className="demo-check" aria-hidden>{isSelected ? <Icon name="check" /> : null}</span> : <span className={`demo-avatar ${memory.author === 'parent' ? 'demo-avatar-parent' : ''}`}>{name.slice(0, 1)}</span>}<span><strong>{name}</strong><p>{mine ? memoryDate(memory) : `${memoryDate(memory)} · 다른 사람의 마음`}</p></span></span>
          <PreviewMedia memory={memory} />
          {memory.caption ? <p className="demo-caption-preview">{memory.caption}</p> : null}
        </>
        return <li key={memory.id}>{mine && !readOnly
          ? <button type="button" className={`demo-select-card${isSelected ? ' is-selected' : ''}`} aria-pressed={isSelected} aria-label={`${name}님의 마음 고르기${memory.caption ? `: ${memory.caption}` : ''}`} onClick={() => toggle(memory.id)}>{body}</button>
          : <div className="demo-select-card is-disabled" aria-disabled="true">{body}</div>}</li>
      })}</ul> : <div className="demo-empty"><h3>아직 남겨진 마음이 없어요</h3><p>앨범방으로 돌아가 첫 기록을 담아보세요.</p></div>}
    </div>
    <div className="demo-compose-action demo-edit-bar">
      <p role="status">{selected.length ? `${selected.length}개 골랐어요` : '고칠 마음을 눌러 골라 주세요'}</p>
      <div className="demo-edit-actions">
        {single ? <Link className="demo-secondary" href={`${ROOM}/memories/${single}/edit`}>수정</Link> : <button type="button" className="demo-secondary" disabled>수정</button>}
        <button type="button" className="demo-secondary is-danger" disabled={!selected.length || readOnly} onClick={() => setConfirming(true)}>삭제</button>
      </div>
      {selected.length > 1 ? <p>수정은 한 개만 골랐을 때 할 수 있어요.</p> : null}
    </div>
    {confirming ? <ConfirmDialog title={`마음 ${selected.length}개를 삭제할까요?`} body="고른 마음의 손글씨·목소리·사진·영상·한마디와 받은 반응이 모두 지워져요. 되돌릴 수 없어요." confirmLabel="삭제하기" pendingLabel="삭제하는 중…" onCancel={() => setConfirming(false)} onConfirm={async () => {
      const count = selected.length
      await mutate((current) => withoutMemories(current, selected))
      setSelected([])
      setConfirming(false)
      onNotice(`마음 ${count}개를 삭제했어요`)
    }} /> : null}
  </main>
}

/** 상세 — 담긴 마음 아래에 좋아요·댓글(2026-09-28, 인스타그램처럼). 댓글 칸은 아래에 고정한다. */
function Detail({ memory, onNotice }: { memory: DemoMemory; onNotice: (message: string) => void }) {
  const { data, mutate, readOnly } = useDemo()
  const router = useRouter()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  if (!data) return null
  const comments = memory.comments ?? []

  async function addComment() {
    const body = text.trim()
    if (!data || !body || busy) return
    setBusy(true)
    setError(null)
    try {
      const comment = { id: crypto.randomUUID(), author: data.actor, text: body, createdAt: new Date().toISOString() }
      await mutate((current) => ({ ...current, memories: current.memories.map((item) => item.id !== memory.id ? item : { ...item, comments: [...(item.comments ?? []), comment] }) }))
      setText('')
    } catch (cause) { setError(messageOf(cause)) }
    finally { setBusy(false) }
  }

  return <main className="demo-main demo-detail demo-compose">
    <div className="demo-compose-fields">
      <div className="demo-author"><span className={`demo-avatar ${memory.author === 'parent' ? 'demo-avatar-parent' : ''}`}>{DEMO_PEOPLE[memory.author].name.slice(0, 1)}</span><div><h2>{DEMO_PEOPLE[memory.author].name}의 마음</h2><p>{memory.example ? '가상의 인물이 남긴 체험용 예시' : new Date(memory.createdAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></div>{memory.author === data.actor && !readOnly ? <MemoryMore memory={memory} onDeleted={() => { router.push(ROOM); onNotice('마음을 삭제했어요') }} /> : null}</div>
      {memory.handwriting ? <section aria-label="손글씨 재생"><HandwritingPlayback memory={memory} /><p className="demo-media-hint">손길을 다시 보고 싶다면 손글씨를 눌러보세요.</p></section> : null}
      {memory.photos.length ? <div className="demo-detail-photos">{memory.photos.map((photo, index) => <Photo key={index} blob={photo} alt={`남긴 추억의 사진 ${index + 1}`} />)}</div> : null}
      {memory.video ? <section aria-label="남긴 영상"><Video memory={memory} /></section> : null}
      {memory.voice ? <section aria-label="남긴 목소리"><Voice memory={memory} /></section> : null}
      <div className="demo-card-actions demo-detail-actions">
        <LikeButton memory={memory} />
        <button type="button" className="demo-action" aria-label={`댓글 ${comments.length}개 · 댓글 달기`} onClick={() => inputRef.current?.focus()}><Icon name="comment" /><span>{comments.length}</span></button>
      </div>
      {memory.caption ? <p className="demo-detail-caption"><strong>{DEMO_PEOPLE[memory.author].name}</strong> {memory.caption}</p> : null}
      <section id="comments" className="demo-comments" aria-label="댓글 목록">
        {comments.length ? <ul>{comments.map((comment) => <li key={comment.id}>
          <span className={`demo-avatar ${comment.author === 'parent' ? 'demo-avatar-parent' : ''}`} aria-hidden>{DEMO_PEOPLE[comment.author].name.slice(0, 1)}</span>
          <div><p><strong>{DEMO_PEOPLE[comment.author].name}</strong> {comment.text}</p><time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></div>
        </li>)}</ul> : <p className="demo-comments-empty">아직 댓글이 없어요.</p>}
      </section>
      {error ? <p className="demo-error" role="alert">{error}</p> : null}
    </div>
    <form className="demo-compose-action demo-comment-form" onSubmit={(event) => { event.preventDefault(); void addComment() }}>
      <label htmlFor="demo-comment" className="demo-visually-hidden">댓글</label>
      <input id="demo-comment" ref={inputRef} value={text} onChange={(event) => setText(event.target.value)} maxLength={CAPTION_MAX_LENGTH} placeholder={`${DEMO_PEOPLE[data.actor].name}(으)로 댓글 달기…`} disabled={readOnly || busy} autoComplete="off" />
      <button type="submit" disabled={!text.trim() || busy || readOnly}>게시</button>
    </form>
  </main>
}

/**
 * 작성 화면. `editing`이 있으면 이미 남긴 마음을 고친다(2026-09-28) — 같은 화면을 원래 내용으로 채워 연다.
 * 고친 초안은 새 마음 초안과 따로 두고, 화면을 떠나면 버린다(앱의 고치기 화면과 같다). 받은 반응은 그대로 둔다.
 */
function Compose({ onSaved, onRecordingChange, editing }: { onSaved: (message: string) => void; onRecordingChange: (active: boolean) => void; editing?: DemoMemory }) {
  const { data, mutate, readOnly, drafts, updateDraft, editDraft, updateEditDraft, clearEditDraft } = useDemo()
  const router = useRouter()
  const actor = data?.actor ?? 'child'
  const base = useMemo(() => editing ? draftFromMemory(editing) : null, [editing])
  const current = editing && base ? (editDraft?.memoryId === editing.id ? editDraft.draft : base) : drafts[actor]
  const update = useCallback((change: (draft: DemoDraft) => DemoDraft) => {
    if (editing && base) updateEditDraft(editing.id, base, change)
    else updateDraft(actor, change)
  }, [actor, base, editing, updateDraft, updateEditDraft])
  // 고치기 화면을 떠나면 고친 초안을 버린다. 기록 객체는 저장소를 다시 읽을 때마다 새로 만들어지므로 번호로 본다.
  const editingKey = editing?.id ?? null
  useEffect(() => editingKey ? () => clearEditDraft() : undefined, [editingKey, clearEditDraft])
  const { method, handwriting, recording, photos, video, caption } = current
  const setMethod = (next: Method) => update((draft) => ({ ...draft, method: next }))
  const setHandwriting = useCallback((next: HandwritingDoc | null) => update((draft) => ({ ...draft, handwriting: next })), [update])
  const setRecording = useCallback((next: VoiceRecording | null) => update((draft) => ({ ...draft, recording: next })), [update])
  const [recordingActive, setRecordingActive] = useState(false)
  const handleRecordingActivity = useCallback((active: boolean) => { setRecordingActive(active); onRecordingChange(active) }, [onRecordingChange])
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const submissionId = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const setVideo = useCallback((next: DemoVideo | null) => update((draft) => ({ ...draft, video: next })), [update])
  const dirty = Boolean(handwriting || recording || photos.length || video || caption)
  const canSave = Boolean(handwriting || recording || photos.length || video) && caption.length <= CAPTION_MAX_LENGTH && !busy && !picking && !readOnly && !recordingActive

  async function pickPhotos(files: FileList | null) {
    if (!files || picking || busy) return
    const chosen = Array.from(files)
    if (photos.length + chosen.length > PHOTO_MAX_COUNT) { setError(`사진은 ${PHOTO_MAX_COUNT}장까지 담을 수 있어요.`); return }
    setPicking(true)
    setError(null)
    try {
      const next = await Promise.all(chosen.map(async (file) => {
        if (!file.type.startsWith('image/')) throw new Error('사진 파일을 골라주세요.')
        if (file.size > 20 * 1024 * 1024) throw new Error('이 체험에서는 20MB 이하 사진을 골라주세요.')
        const resized = await resizePhoto(file)
        return { id: crypto.randomUUID(), blob: resized.file }
      }))
      update((draft) => ({ ...draft, photos: [...draft.photos, ...next] }))
    } catch (cause) { setError(messageOf(cause)) }
    finally { setPicking(false); if (fileInput.current) fileInput.current.value = '' }
  }

  async function save() {
    if (!data || !canSave || locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      if (editing) {
        const voice = recording ? { blob: recording.blob, durationSec: recording.durationSec, levels: recording.levels } : null
        const updated: DemoMemory = { ...editing, caption: caption.trim(), handwriting, voice, photos: photos.map((photo) => photo.blob), video }
        validateMemory(updated)
        await mutate((snapshot) => ({ ...snapshot, memories: snapshot.memories.map((item) => item.id === editing.id ? { ...updated, likedBy: item.likedBy } : item) }))
        clearEditDraft()
        onSaved('마음을 고쳤어요.')
        router.push(`${ROOM}/memories/${editing.id}`)
        return
      }
      submissionId.current ??= crypto.randomUUID()
      const memory: DemoMemory = {
        id: submissionId.current,
        author: data.actor,
        createdAt: new Date().toISOString(),
        caption: caption.trim(),
        handwriting,
        voice: recording ? { blob: recording.blob, durationSec: recording.durationSec, levels: recording.levels } : null,
        photos: photos.map((photo) => photo.blob),
        video,
        likedBy: [],
        example: false,
      }
      validateMemory(memory)
      await mutate((current) => ({ ...current, memories: current.memories.some((item) => item.id === memory.id) ? current.memories : [memory, ...current.memories] }))
      updateDraft(actor, emptyDemoDraft)
      onSaved('마음을 남겼어요. 이 브라우저에서 다시 볼 수 있어요.')
      router.push(`${ROOM}/memories/${memory.id}`)
    } catch (cause) { setError(messageOf(cause)); locked.current = false; setBusy(false) }
  }

  const filled = { handwriting: Boolean(handwriting), voice: Boolean(recording), photo: photos.length > 0, video: Boolean(video) }

  return <main className="demo-main demo-compose">
    <div className="demo-compose-fields">
    {/* 수단을 고른 뒤에는 소개를 접어 쓰는 공간을 넓힌다. */}
    {!method && !editing ? <section className="demo-compose-intro"><p className="demo-subtle">소중한 존재에게</p><h2>어떤 마음을 남길까요?</h2><p>편한 방법 하나면 충분해요.<br />다른 방법도 나중에 함께 담을 수 있어요.</p></section> : null}

    <div className={`demo-methods${method ? ' demo-methods--compact' : ''}`} role="group" aria-label="마음 남길 방법">
      {METHODS.map((item) => <button key={item.key} type="button" className={`demo-method${method === item.key ? ' is-selected' : ''}`} aria-pressed={method === item.key} onClick={() => setMethod(item.key)} disabled={busy || recordingActive}>
        <span className="demo-method-icon"><Icon name={item.key} /></span><span className="demo-method-text"><strong>{item.title}</strong><span>{item.detail}</span></span>{method ? null : <span className="demo-method-arrow" aria-hidden><Icon name="next" /></span>}{filled[item.key] ? <span className="demo-method-done" aria-label="담았어요"><Icon name="check" /></span> : null}
      </button>)}
    </div>

    {method ? <p className="demo-switch-hint">다른 탭을 눌러 함께 담아도, 먼저 쓴 내용은 남아 있어요.</p> : null}
    {/* 숨겨도 마운트는 유지한다. 다른 수단을 고르는 동안 녹음·손글씨가 사라지지 않는다. */}
    <section hidden={method !== 'handwriting'} className="demo-input-section" aria-label="손글씨 담기"><div className="demo-input-heading"><h3>손글씨로 남겨요</h3><span>쓰는 모습도 함께 담겨요</span></div><HandwritingPad value={handwriting} onChange={setHandwriting} disabled={busy} /></section>
    <section hidden={method !== 'voice'} className="demo-input-section" aria-label="목소리 담기"><div className="demo-input-heading"><h3>목소리로 남겨요</h3><span>최대 1분</span></div><VoiceRecorder value={recording} onChange={setRecording} onActivityChange={handleRecordingActivity} disabled={busy || method !== 'voice'} />{recordingActive ? <p className="demo-media-hint">녹음을 마친 뒤 다른 방법을 함께 담을 수 있어요.</p> : null}</section>
    <section hidden={method !== 'photo'} className="demo-input-section" aria-label="사진 담기"><div className="demo-input-heading"><h3>오늘의 사진을 담아요</h3><span>{photos.length}/{PHOTO_MAX_COUNT}</span></div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => void pickPhotos(event.target.files)} /><button className="demo-photo-picker" type="button" onClick={() => fileInput.current?.click()} disabled={busy || picking || photos.length >= PHOTO_MAX_COUNT}><Icon name="photo" />{picking ? '사진을 준비하는 중…' : '사진 고르기'}</button>
      {photos.length ? <ul className="demo-photo-grid">{photos.map((photo, index) => <li key={photo.id}><Photo blob={photo.blob} alt={`선택한 사진 ${index + 1}`} /><button type="button" aria-label={`${index + 1}번째 사진 빼기`} disabled={busy} onClick={() => update((draft) => ({ ...draft, photos: draft.photos.filter((item) => item.id !== photo.id) }))}>×</button></li>)}</ul> : null}
    </section>
    <section hidden={method !== 'video'} className="demo-input-section" aria-label="영상 담기"><div className="demo-input-heading"><h3>영상으로 남겨요</h3><span>움직이는 순간 그대로</span></div><DemoVideoField video={video} onChange={setVideo} disabled={busy} /></section>

    {dirty ? <div className="demo-attached" aria-label="지금 담은 내용">{handwriting ? <span><Icon name="check" />손글씨</span> : null}{recording ? <span><Icon name="check" />목소리 {formatDuration(recording.durationSec)}</span> : null}{photos.length ? <span><Icon name="check" />사진 {photos.length}장</span> : null}{video ? <span><Icon name="check" />영상 {formatVideoDuration(video.durationMs)}</span> : null}</div> : null}

    {method ? <div className="demo-caption-field"><label htmlFor="demo-caption">함께 남길 한마디 <span>선택</span></label><textarea id="demo-caption" value={caption} onChange={(event) => update((draft) => ({ ...draft, caption: event.target.value }))} maxLength={CAPTION_MAX_LENGTH} rows={3} placeholder={actor === 'child' ? '엄마, 오늘 문득 이 말을 하고 싶었어.' : '지우야, 오늘 문득 이 말을 해주고 싶었어.'} disabled={busy} /><span className="demo-character-count">{caption.length}/{CAPTION_MAX_LENGTH}</span></div> : null}
    {error ? <p className="demo-error" role="alert">{error}</p> : null}
    </div>
    <div className="demo-compose-action"><Button fullWidth onClick={() => void save()} disabled={!canSave} pending={busy} pendingText={editing ? '고치는 중…' : '마음을 담는 중…'}>{editing ? '고친 내용 저장하기' : '마음 남기기'}</Button><p>{readOnly ? '현재 브라우저 저장소를 사용할 수 없어요.' : '실제로 전송되지 않고, 이 브라우저에만 저장돼요.'}</p></div>
  </main>
}
