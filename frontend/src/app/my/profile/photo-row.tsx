'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { AvatarCropDialog } from '@/app/my/profile/avatar-crop-dialog'
import {
  updateProfileImage,
  type ProfileImageState,
} from '@/lib/actions/profile'

/**
 * "프로필 사진 변경" 한 줄 (참고/마이_프로필탭_상세.png).
 *
 * 누르면 사진 고르기 → 자르기 → 올리기가 한 번에 이어진다.
 * 중간에 "선택했습니다" 같은 단계를 두지 않았다 — 시니어 사용자에게 누를 곳이
 * 하나 더 늘어나는 것이 곧 멈추는 지점이 된다.
 *
 * 자르기는 브라우저에서 끝낸다. 휴대폰 사진 원본은 한 장에 3~8MB라
 * 그대로 보내면 Server Action 본문 제한(1MB)에 걸린다. 512px 정사각형으로
 * 구워 보내면 100KB 안쪽이다.
 *
 * 목록에 놓이는 부품이라 <li>를 직접 그린다. 감싸는 <ul>은 서버 화면에 있다.
 */

/** 고를 수 있는 사진 형식. avatars 버킷 설정과 같은 값이다. */
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'

export function ProfilePhotoRow() {
  const [state, formAction, pending] = useActionState<
    ProfileImageState,
    FormData
  >(updateProfileImage, null)

  /** 고른 원본. 값이 있으면 자르기 화면이 떠 있다는 뜻이다. */
  const [picked, setPicked] = useState<File | null>(null)

  /** 자르기까지 끝난 파일. 이 값이 바뀌면 곧바로 서버로 보낸다. */
  const [cropped, setCropped] = useState<File | null>(null)

  const formRef = useRef<HTMLFormElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)

  /*
    잘라낸 파일을 폼에 실어 보내는 통로.

    File은 input.value로 넣을 수 없어서(브라우저가 막는다) DataTransfer로
    진짜 파일 목록을 만들어 넣는다. 그래야 <form action={...}>이 multipart로
    그대로 실어 보낸다 — fetch를 직접 짤 필요가 없다.
    넣자마자 requestSubmit()으로 보낸다. 사용자가 "선택"을 눌렀다는 것이
    이미 확정 의사표시이므로 버튼을 하나 더 누르게 하지 않는다.
  */
  useEffect(() => {
    const input = uploadRef.current
    const form = formRef.current
    if (!input || !form || !cropped) return

    const transfer = new DataTransfer()
    transfer.items.add(cropped)
    input.files = transfer.files
    form.requestSubmit()
  }, [cropped])

  const error = state?.status === 'error' ? state.message : null
  const done = state?.status === 'done' ? state.message : null

  return (
    <li className="flex flex-col">
      <form ref={formRef} action={formAction}>
        {/* 자르기가 끝난 파일이 담기는 칸. 눈에 보이지 않지만 폼의 일부다. */}
        <input
          ref={uploadRef}
          type="file"
          name="avatar_file"
          accept={ACCEPTED_IMAGE_TYPES}
          hidden
          tabIndex={-1}
          aria-hidden
        />

        {/*
          원본 고르기. label 대신 button을 쓴다 — label은 키보드 초점을 받지 못해
          탭으로만 쓰는 분이 이 줄을 통째로 지나쳐 버린다.
        */}
        <input
          ref={pickerRef}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          hidden
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) setPicked(file)
            // 같은 사진을 다시 골라도 change가 일어나야 하므로 값을 비운다.
            event.target.value = ''
          }}
        />

        <button
          type="button"
          disabled={pending}
          onClick={() => pickerRef.current?.click()}
          className="flex min-h-[52px] w-full items-center justify-between gap-3 px-5 py-4 text-left text-lg text-ink active:bg-surface-soft disabled:opacity-60"
        >
          프로필 사진 변경
          {pending ? (
            <span className="shrink-0 text-base text-muted">올리는 중…</span>
          ) : (
            <span aria-hidden className="shrink-0 text-muted">
              ›
            </span>
          )}
        </button>
      </form>

      {/* 방금 무슨 일이 있었는지 알린다. 화면 낭독기도 이 칸을 읽는다. */}
      {error ? (
        <p role="alert" className="px-5 pb-4 text-base break-keep text-primary">
          {error}
        </p>
      ) : done ? (
        <p role="status" className="px-5 pb-4 text-base break-keep text-muted">
          {done}
        </p>
      ) : null}

      {picked ? (
        <AvatarCropDialog
          file={picked}
          onCancel={() => setPicked(null)}
          onConfirm={(file) => {
            setPicked(null)
            setCropped(file)
          }}
        />
      ) : null}
    </li>
  )
}
