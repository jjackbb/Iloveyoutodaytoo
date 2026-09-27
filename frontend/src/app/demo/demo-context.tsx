'use client'

import { usePathname } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DemoStorageError, updateDemo } from '@/lib/demo/store'
import { createDemoSeed, emptyDemoDraft, type DemoActor, type DemoDraft, type DemoSnapshot } from '@/lib/demo/model'

type DemoContextValue = {
  data: DemoSnapshot | null
  loading: boolean
  readOnly: boolean
  /** 읽기 전용이 된 원인을 초기화로 풀 수 있는가. 저장소 자체를 못 열면 초기화도 실패한다. */
  resettable: boolean
  error: string | null
  /** 작성 화면에 들어오기 직전의 데모 주소. 작성 주소로 바로 들어왔다면 null. */
  composeOrigin: string | null
  mutate: (change: (data: DemoSnapshot) => DemoSnapshot) => Promise<void>
  reset: () => Promise<void>
  drafts: Record<DemoActor, DemoDraft>
  updateDraft: (actor: DemoActor, change: (draft: DemoDraft) => DemoDraft) => void
  /** 이미 남긴 마음을 고치는 중인 초안(2026-09-28). 새 마음 초안과 섞이지 않게 따로 둔다. */
  editDraft: { memoryId: string; draft: DemoDraft } | null
  /** 고치는 초안을 바꾼다. 처음이면 `base`(기록에서 만든 초안)에서 시작한다. */
  updateEditDraft: (memoryId: string, base: DemoDraft, change: (draft: DemoDraft) => DemoDraft) => void
  clearEditDraft: () => void
}

const COMPOSE_PATH = '/demo/rooms/family/compose'
const DemoContext = createContext<DemoContextValue | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  const [resettable, setResettable] = useState(true)
  // 작성 화면의 뒤로 가기는 들어온 화면으로 돌아간다. 레이아웃은 화면을 오가도 유지되므로 여기서 기억한다.
  const pathname = usePathname()
  const [route, setRoute] = useState<{ path: string; composeOrigin: string | null }>({ path: pathname, composeOrigin: null })
  if (route.path !== pathname) {
    setRoute({ path: pathname, composeOrigin: pathname === COMPOSE_PATH ? route.path : route.composeOrigin })
  }
  // 화면을 오가도 초안을 유지한다. 저장과 구분하고 탭을 닫기 전 알린다.
  const [drafts, setDrafts] = useState<Record<DemoActor, DemoDraft>>({ child: emptyDemoDraft(), parent: emptyDemoDraft() })
  const updateDraft = useCallback((actor: DemoActor, change: (draft: DemoDraft) => DemoDraft) => {
    setDrafts((current) => ({ ...current, [actor]: change(current[actor]) }))
  }, [])

  const [editDraft, setEditDraft] = useState<{ memoryId: string; draft: DemoDraft } | null>(null)
  const updateEditDraft = useCallback((memoryId: string, base: DemoDraft, change: (draft: DemoDraft) => DemoDraft) => {
    setEditDraft((current) => ({ memoryId, draft: change(current?.memoryId === memoryId ? current.draft : base) }))
  }, [])
  const clearEditDraft = useCallback(() => setEditDraft(null), [])

  useEffect(() => {
    const dirty = editDraft !== null || Object.values(drafts).some((draft) => draft.handwriting || draft.recording || draft.photos.length || draft.video || draft.caption)
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [drafts, editDraft])

  useEffect(() => {
    let active = true
    updateDemo().then((value) => {
      if (active) { setData(value); setError(null); setReadOnly(false) }
    }).catch((cause: unknown) => {
      if (active) {
        setData(createDemoSeed())
        setReadOnly(true)
        setResettable(cause instanceof DemoStorageError ? cause.resettable : true)
        setError(cause instanceof Error ? cause.message : '체험 내용을 불러오지 못했어요.')
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const mutate = useCallback(async (change: (value: DemoSnapshot) => DemoSnapshot) => {
    const value = await updateDemo(change)
    setData(value)
    setError(null)
    setReadOnly(false)
  }, [])

  const reset = useCallback(async () => {
    const value = await updateDemo(undefined, true)
    setData(value)
    setError(null)
    setReadOnly(false)
    setDrafts({ child: emptyDemoDraft(), parent: emptyDemoDraft() })
    setEditDraft(null)
  }, [])

  return <DemoContext.Provider value={{ data, loading, error, readOnly, resettable, composeOrigin: route.composeOrigin, mutate, reset, drafts, updateDraft, editDraft, updateEditDraft, clearEditDraft }}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('DemoProvider가 필요합니다.')
  return context
}
