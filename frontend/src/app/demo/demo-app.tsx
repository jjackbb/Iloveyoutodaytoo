'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BrandMark } from '@/components/brand/BrandMark'
import { HandwritingPad } from '@/components/handwriting/HandwritingPad'
import { HandwritingPlayer } from '@/components/handwriting/HandwritingPlayer'
import { HandwritingView } from '@/components/handwriting/HandwritingView'
import { VoiceRecorder, type VoiceRecording } from '@/components/message/VoiceRecorder'
import { VoicePlayer } from '@/components/media/VoicePlayer'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import { type HandwritingDoc } from '@/lib/handwriting'
import { CAPTION_MAX_LENGTH, PHOTO_MAX_COUNT } from '@/lib/limits'
import { resizePhoto } from '@/lib/image'
import { DEMO_PEOPLE, emptyDemoDraft, validateMemory, type DemoActor, type DemoMemory } from '@/lib/demo/model'
import { useDemo } from './demo-context'

const ROOM = '/demo/rooms/family'
type Method = 'handwriting' | 'voice' | 'photo'
const METHODS: { key: Method; title: string; detail: string }[] = [
  { key: 'handwriting', title: '손글씨', detail: '내 손길 그대로' },
  { key: 'voice', title: '목소리', detail: '짧은 한마디로' },
  { key: 'photo', title: '사진', detail: '오늘의 한 장으로' },
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
    check: <path d="m5 12 4 4L19 6" />,
    reset: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /></>,
  }
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name] ?? paths.heart}</svg>
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

function HandwritingPlayback({ memory }: { memory: DemoMemory }) {
  const blob = useMemo(() => memory.handwriting ? new Blob([JSON.stringify(memory.handwriting)], { type: 'application/json' }) : null, [memory.handwriting])
  const url = useBlobUrl(blob)
  return url ? <HandwritingPlayer key={url} src={url} label={`${DEMO_PEOPLE[memory.author].name}님의 손글씨`} autoPlay /> : null
}

export function DemoApp() {
  const pathname = usePathname()
  const router = useRouter()
  const { data, loading, error, readOnly, mutate, reset } = useDemo()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const composing = pathname === `${ROOM}/compose`
  const isHome = pathname === '/demo'
  const isRoom = pathname === ROOM
  const detailId = pathname.startsWith(`${ROOM}/memories/`) ? pathname.slice(`${ROOM}/memories/`.length) : null
  const memory = data?.memories.find((item) => item.id === detailId)

  const notify = useCallback((text: string) => setNotice({ id: Date.now(), text }), [])

  async function changeActor(actor: DemoActor) {
    if (busy || composing) return
    setBusy(true)
    try {
      await mutate((current) => ({ ...current, actor }))
      notify(`${DEMO_PEOPLE[actor].name}의 시점으로 바꿨어요`)
    } catch (cause) { setFailure(messageOf(cause)) }
    finally { setBusy(false) }
  }

  async function startOver() {
    if (busy || !window.confirm('이 브라우저에서 체험하며 남긴 손글씨·목소리·사진과 반응을 지우고, 처음의 예시로 돌아갈까요?')) return
    setBusy(true)
    try {
      await reset()
      setFailure(null)
      router.push('/demo')
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
          <Link href="/demo" className="demo-label">포트폴리오 데모</Link>
          <div className="demo-tools">
            <label className="demo-actor-label">
              <span>보는 사람</span>
              <select aria-label="체험 인물" disabled={loading || busy || composing || readOnly} value={data?.actor ?? 'child'} onChange={(event) => void changeActor(event.target.value as DemoActor)}>
                <option value="child">지우 · 자녀</option>
                <option value="parent">엄마 · 부모</option>
              </select>
            </label>
            <button className="demo-reset" type="button" disabled={busy || composing} onClick={() => void startOver()} aria-label="데모 초기화"><Icon name="reset" /><span>초기화</span></button>
          </div>
        </div>
      </div>

      <div className={`demo-phone${composing ? ' demo-phone--compose' : ''}`}>
        <header className="demo-appbar">
          {isHome ? <h1 className="demo-brand"><BrandMark size={27} />오늘도 사랑해</h1> : <>
            <Link className="demo-icon-button" href={isRoom ? '/demo' : ROOM} aria-label={isRoom ? '홈으로 돌아가기' : '가족방으로 돌아가기'}><Icon name="back" /></Link>
            <h1>{composing ? '마음 남기기' : '우리 가족'}</h1>
            <span className="demo-appbar-spacer" aria-hidden />
          </>}
        </header>

        <div className="demo-context-note">가상의 가족방이에요. 내용은 이 브라우저에만 남아요.</div>

        {failure || error ? <div className="demo-error" role="alert">{failure ?? error}{readOnly ? <p>지금은 예시만 볼 수 있어요. 위의 초기화로 다시 시도할 수 있어요.</p> : null}</div> : null}

        {loading || !data ? <main className="demo-main"><p role="status">가족방을 준비하고 있어요…</p></main> : isHome ? <Home /> : isRoom ? <Room /> : composing ? <Compose key={data.actor} onSaved={notify} /> : memory ? <Detail key={memory.id} memory={memory} /> : <main className="demo-main demo-empty"><h2>이 마음을 찾지 못했어요</h2><p>예시를 초기화했거나 주소가 바뀌었을 수 있어요.</p><Link className="demo-primary" href={ROOM}>가족방으로 돌아가기</Link></main>}

        {!composing ? <footer className="demo-footer"><span>실제 전송 없이 체험하는 화면</span><Link href="/welcome">서비스 소개</Link></footer> : null}
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

  return <main className="demo-main demo-home">
    <section className="demo-greeting">
      <p>{DEMO_PEOPLE[data.actor].name}님, 반가워요</p>
      <h2>우리 사이에 쌓인 마음</h2>
      <p className="demo-subtle">오늘은 어떤 마음을 남겨볼까요?</p>
    </section>

    <section aria-label="나의 앨범방">
      <div className="demo-section-heading"><h3>나의 앨범방</h3><span>1</span></div>
      <article className="demo-album">
        <Link className="demo-album-link" href={ROOM} aria-label={`우리 가족 앨범방 열기${unread ? `, 새 마음 ${unread}개` : ''}`}>
          <div className="demo-cover-art" aria-hidden>{recent?.handwriting ? <HandwritingView doc={recent.handwriting} label="" /> : <BrandMark size={64} />}</div>
          <span className="demo-album-name">우리 가족{unread > 0 ? <span className="demo-unread" aria-hidden>{unread > 99 ? '99+' : unread}</span> : null}</span>
        </Link>
        <button type="button" className={`demo-album-favorite${data.favorite[data.actor] ? ' is-favorite' : ''}`} aria-label="우리 가족 앨범방 즐겨찾기" aria-pressed={data.favorite[data.actor]} disabled={busy || readOnly} onClick={async () => {
          setBusy(true)
          try { await mutate((current) => ({ ...current, favorite: { ...current.favorite, [data.actor]: !current.favorite[data.actor] } })) }
          catch (cause) { setError(messageOf(cause)) }
          finally { setBusy(false) }
        }}><Icon name="heart" filled={data.favorite[data.actor]} /></button>
      </article>
      <p className="demo-album-hint">엄마와 지우가 함께 남기는 공간</p>
    </section>

    {error ? <p className="demo-error" role="alert">{error}</p> : null}

    <section className="demo-invitation">
      <span className="demo-small-icon"><Icon name="handwriting" /></span>
      <div><h3>길게 쓰지 않아도 괜찮아요</h3><p>손글씨 한 줄, 짧은 목소리, 오늘의 사진 한 장.</p></div>
    </section>
    <Link className="demo-primary" href={`${ROOM}/compose`}><Icon name="plus" />마음 남기기</Link>
  </main>
}

function Room() {
  const { data } = useDemo()
  if (!data) return null
  return <main className="demo-main">
    <section className="demo-room-heading"><p className="demo-subtle">엄마와 지우의 앨범방</p><h2>함께 남긴 작은 순간들</h2><Link className="demo-primary" href={`${ROOM}/compose`}><Icon name="plus" />마음 남기기</Link></section>
    <div className="demo-section-heading"><h3>남겨진 마음</h3><span>{data.memories.length}</span></div>
    {data.memories.length ? <ul className="demo-feed">{data.memories.map((memory) => <li key={memory.id}>
      <Link href={`${ROOM}/memories/${memory.id}`} className="demo-memory-preview">
        <div className="demo-author"><span className={`demo-avatar ${memory.author === 'parent' ? 'demo-avatar-parent' : ''}`}>{DEMO_PEOPLE[memory.author].name.slice(0, 1)}</span><div><strong>{DEMO_PEOPLE[memory.author].name}</strong><p>{memory.example ? '체험용 예시' : new Date(memory.createdAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}</p></div><span className="demo-preview-arrow"><Icon name="next" /></span></div>
        {memory.handwriting ? <div className="demo-handwriting-preview"><HandwritingView doc={memory.handwriting} label={`${DEMO_PEOPLE[memory.author].name}님의 손글씨`} /></div> : memory.photos[0] ? <Photo blob={memory.photos[0]} alt="남긴 추억의 첫 사진" /> : <div className="demo-voice-preview"><Icon name="voice" /><span>목소리 {memory.voice?.durationSec}초</span><span>들어보기</span></div>}
        {memory.caption ? <p className="demo-caption-preview">{memory.caption}</p> : null}
        <div className="demo-memory-meta"><span>{memory.handwriting ? '손글씨 재생' : '마음 열어보기'}</span>{memory.likedBy.length > 0 ? <span><Icon name="heart" filled />{memory.likedBy.length}</span> : null}</div>
      </Link>
    </li>)}</ul> : <div className="demo-empty"><h3>아직 남겨진 마음이 없어요</h3><p>위의 마음 남기기로 첫 기록을 담아보세요.</p></div>}
  </main>
}

function Detail({ memory }: { memory: DemoMemory }) {
  const { data, mutate, readOnly } = useDemo()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!data) return null
  const liked = memory.likedBy.includes(data.actor)
  return <main className="demo-main demo-detail">
    <div className="demo-author"><span className={`demo-avatar ${memory.author === 'parent' ? 'demo-avatar-parent' : ''}`}>{DEMO_PEOPLE[memory.author].name.slice(0, 1)}</span><div><h2>{DEMO_PEOPLE[memory.author].name}의 마음</h2><p>{memory.example ? '가상의 가족이 남긴 체험용 예시' : new Date(memory.createdAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p></div></div>
    {memory.handwriting ? <section aria-label="손글씨 재생"><HandwritingPlayback memory={memory} /><p className="demo-media-hint">손길을 다시 보고 싶다면 손글씨를 눌러보세요.</p></section> : null}
    {memory.photos.length ? <div className="demo-detail-photos">{memory.photos.map((photo, index) => <Photo key={index} blob={photo} alt={`남긴 추억의 사진 ${index + 1}`} />)}</div> : null}
    {memory.voice ? <section aria-label="남긴 목소리"><Voice memory={memory} /></section> : null}
    {memory.caption ? <p className="demo-detail-caption">{memory.caption}</p> : null}
    <div className="demo-reaction-row"><button type="button" className={`demo-reaction${liked ? ' is-liked' : ''}`} disabled={busy || readOnly} aria-pressed={liked} onClick={async () => {
      setBusy(true)
      try {
        const actor = data.actor
        await mutate((current) => ({ ...current, memories: current.memories.map((item) => item.id !== memory.id ? item : { ...item, likedBy: item.likedBy.includes(actor) ? item.likedBy.filter((person) => person !== actor) : [...item.likedBy, actor] }) }))
      } catch (cause) { setError(messageOf(cause)) }
      finally { setBusy(false) }
    }}><Icon name="heart" filled={liked} />{liked ? '마음이 닿았어요' : '마음 전하기'}<span>{memory.likedBy.length}</span></button></div>
    {error ? <p className="demo-error" role="alert">{error}</p> : null}
    <p className="demo-detail-note">답장을 서두르지 않아도 괜찮아요.<br />천천히 다시 꺼내봐도 괜찮아요.</p>
    <Link className="demo-secondary" href={ROOM}>함께 남긴 마음 더 보기</Link>
  </main>
}

function Compose({ onSaved }: { onSaved: (message: string) => void }) {
  const { data, mutate, readOnly, drafts, updateDraft } = useDemo()
  const router = useRouter()
  const actor = data?.actor ?? 'child'
  const { method, handwriting, recording, photos, caption } = drafts[actor]
  const setMethod = (next: Method) => updateDraft(actor, (draft) => ({ ...draft, method: next }))
  const setHandwriting = useCallback((next: HandwritingDoc | null) => updateDraft(actor, (draft) => ({ ...draft, handwriting: next })), [actor, updateDraft])
  const setRecording = useCallback((next: VoiceRecording | null) => updateDraft(actor, (draft) => ({ ...draft, recording: next })), [actor, updateDraft])
  const [recordingActive, setRecordingActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const locked = useRef(false)
  const submissionId = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dirty = Boolean(handwriting || recording || photos.length || caption)
  const canSave = Boolean(handwriting || recording || photos.length) && caption.length <= CAPTION_MAX_LENGTH && !busy && !picking && !readOnly && !recordingActive

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
      updateDraft(actor, (draft) => ({ ...draft, photos: [...draft.photos, ...next] }))
    } catch (cause) { setError(messageOf(cause)) }
    finally { setPicking(false); if (fileInput.current) fileInput.current.value = '' }
  }

  async function save() {
    if (!data || !canSave || locked.current) return
    locked.current = true
    setBusy(true)
    setError(null)
    try {
      submissionId.current ??= crypto.randomUUID()
      const memory: DemoMemory = {
        id: submissionId.current,
        author: data.actor,
        createdAt: new Date().toISOString(),
        caption: caption.trim(),
        handwriting,
        voice: recording ? { blob: recording.blob, durationSec: recording.durationSec, levels: recording.levels } : null,
        photos: photos.map((photo) => photo.blob),
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

  const filled = { handwriting: Boolean(handwriting), voice: Boolean(recording), photo: photos.length > 0 }

  return <main className="demo-main demo-compose">
    <div className="demo-compose-fields">
    <section className="demo-compose-intro"><p className="demo-subtle">우리 가족에게</p><h2>어떤 마음을 남길까요?</h2><p>편한 방법 하나면 충분해요.<br />다른 방법도 나중에 함께 담을 수 있어요.</p></section>

    <div className={`demo-methods${method ? ' demo-methods--compact' : ''}`} role="group" aria-label="마음 남길 방법">
      {METHODS.map((item) => <button key={item.key} type="button" className={`demo-method${method === item.key ? ' is-selected' : ''}`} aria-pressed={method === item.key} onClick={() => setMethod(item.key)} disabled={busy || recordingActive}>
        <span className="demo-method-icon"><Icon name={item.key} /></span><strong>{item.title}</strong><span>{item.detail}</span>{filled[item.key] ? <span className="demo-method-done" aria-label="담았어요"><Icon name="check" /></span> : null}
      </button>)}
    </div>

    {!method ? <div className="demo-method-instruction"><p>위에서 마음을 남길 방법을 골라주세요.</p></div> : null}

    {method ? <p className="demo-switch-hint">다른 탭을 눌러 함께 담아도, 먼저 쓴 내용은 남아 있어요.</p> : null}
    {/* 숨겨도 마운트는 유지한다. 다른 수단을 고르는 동안 녹음·손글씨가 사라지지 않는다. */}
    <section hidden={method !== 'handwriting'} className="demo-input-section" aria-label="손글씨 담기"><div className="demo-input-heading"><h3>손글씨로 남겨요</h3><span>쓰는 모습도 함께 담겨요</span></div><HandwritingPad value={handwriting} onChange={setHandwriting} disabled={busy} /></section>
    <section hidden={method !== 'voice'} className="demo-input-section" aria-label="목소리 담기"><div className="demo-input-heading"><h3>목소리로 남겨요</h3><span>3초부터 1분까지</span></div><VoiceRecorder value={recording} onChange={setRecording} onActivityChange={setRecordingActive} disabled={busy || method !== 'voice'} />{recordingActive ? <p className="demo-media-hint">녹음을 마친 뒤 다른 방법을 함께 담을 수 있어요.</p> : null}</section>
    <section hidden={method !== 'photo'} className="demo-input-section" aria-label="사진 담기"><div className="demo-input-heading"><h3>오늘의 사진을 담아요</h3><span>{photos.length}/{PHOTO_MAX_COUNT}</span></div><input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(event) => void pickPhotos(event.target.files)} /><button className="demo-photo-picker" type="button" onClick={() => fileInput.current?.click()} disabled={busy || picking || photos.length >= PHOTO_MAX_COUNT}><Icon name="photo" />{picking ? '사진을 준비하는 중…' : '사진 고르기'}</button>
      {photos.length ? <ul className="demo-photo-grid">{photos.map((photo, index) => <li key={photo.id}><Photo blob={photo.blob} alt={`선택한 사진 ${index + 1}`} /><button type="button" aria-label={`${index + 1}번째 사진 빼기`} disabled={busy} onClick={() => updateDraft(actor, (draft) => ({ ...draft, photos: draft.photos.filter((item) => item.id !== photo.id) }))}>×</button></li>)}</ul> : null}
    </section>

    {dirty ? <div className="demo-attached" aria-label="지금 담은 내용">{handwriting ? <span><Icon name="check" />손글씨</span> : null}{recording ? <span><Icon name="check" />목소리 {recording.durationSec}초</span> : null}{photos.length ? <span><Icon name="check" />사진 {photos.length}장</span> : null}</div> : null}

    {method ? <div className="demo-caption-field"><label htmlFor="demo-caption">함께 남길 한마디 <span>선택</span></label><textarea id="demo-caption" value={caption} onChange={(event) => updateDraft(actor, (draft) => ({ ...draft, caption: event.target.value }))} maxLength={CAPTION_MAX_LENGTH} rows={3} placeholder={actor === 'child' ? '엄마, 오늘 문득 이 말을 하고 싶었어.' : '지우야, 오늘 문득 이 말을 해주고 싶었어.'} disabled={busy} /><span className="demo-character-count">{caption.length}/{CAPTION_MAX_LENGTH}</span></div> : null}
    {error ? <p className="demo-error" role="alert">{error}</p> : null}
    </div>
    <div className="demo-compose-action"><Button fullWidth onClick={() => void save()} disabled={!canSave} pending={busy} pendingText="마음을 담는 중…">마음 남기기</Button><p>{readOnly ? '현재 브라우저 저장소를 사용할 수 없어요.' : '실제로 전송되지 않고, 이 브라우저에만 저장돼요.'}</p></div>
  </main>
}
