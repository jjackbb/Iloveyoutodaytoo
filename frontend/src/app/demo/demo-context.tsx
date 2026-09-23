'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { updateDemo } from '@/lib/demo/store'
import { createDemoSeed, emptyDemoDraft, type DemoActor, type DemoDraft, type DemoSnapshot } from '@/lib/demo/model'

type DemoContextValue = {
  data: DemoSnapshot | null
  loading: boolean
  readOnly: boolean
  error: string | null
  mutate: (change: (data: DemoSnapshot) => DemoSnapshot) => Promise<void>
  reset: () => Promise<void>
  drafts: Record<DemoActor, DemoDraft>
  updateDraft: (actor: DemoActor, change: (draft: DemoDraft) => DemoDraft) => void
}

const DemoContext = createContext<DemoContextValue | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DemoSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readOnly, setReadOnly] = useState(false)
  // 화면을 오가도 초안을 유지한다. 저장과 구분하고 탭을 닫기 전 알린다.
  const [drafts, setDrafts] = useState<Record<DemoActor, DemoDraft>>({ child: emptyDemoDraft(), parent: emptyDemoDraft() })
  const updateDraft = useCallback((actor: DemoActor, change: (draft: DemoDraft) => DemoDraft) => {
    setDrafts((current) => ({ ...current, [actor]: change(current[actor]) }))
  }, [])

  useEffect(() => {
    const dirty = Object.values(drafts).some((draft) => draft.handwriting || draft.recording || draft.photos.length || draft.caption)
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [drafts])

  useEffect(() => {
    let active = true
    updateDemo().then((value) => {
      if (active) { setData(value); setError(null); setReadOnly(false) }
    }).catch((cause: unknown) => {
      if (active) {
        setData(createDemoSeed())
        setReadOnly(true)
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
  }, [])

  return <DemoContext.Provider value={{ data, loading, error, readOnly, mutate, reset, drafts, updateDraft }}>{children}</DemoContext.Provider>
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('DemoProvider가 필요합니다.')
  return context
}
