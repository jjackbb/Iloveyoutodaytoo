'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

type ReplyTarget = { parentId: string; authorName: string }
type ReplyContextValue = {
  target: ReplyTarget | null
  setTarget: (target: ReplyTarget | null) => void
}

const ReplyContext = createContext<ReplyContextValue | null>(null)

export function ReplyProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReplyTarget | null>(null)
  return <ReplyContext.Provider value={{ target, setTarget }}>{children}</ReplyContext.Provider>
}

export function useReply() {
  const value = useContext(ReplyContext)
  if (!value) throw new Error('ReplyProvider가 필요합니다.')
  return value
}
