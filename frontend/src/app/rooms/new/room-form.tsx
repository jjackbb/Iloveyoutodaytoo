'use client'

import { useActionState, useEffect, useRef, useState } from 'react'

import { CoverCropDialog } from '@/app/rooms/new/cover-crop-dialog'
import { Button } from '@/components/ui/Button'
import { Field, FieldShell } from '@/components/ui/Field'
import { Toast } from '@/components/ui/Toast'
import { createRoom, type CreateRoomState } from '@/lib/actions/rooms'
import { COVER_PRESET_LIST, type CoverPreset } from '@/lib/covers'
import { ROOM_NAME_MAX_LENGTH } from '@/lib/limits'

/**
 * 앨범방 만들기 폼 (캡처 06~09).
 *
 * "어떤 사이인가요?"(가족/연인/친구/나자신)는 **묻지 않는다.**
 * 사용자 지시: "왜 정해놓고 시작하려고 그래, 개방적이 돼라."
 * 관계 개념 자체가 캡처 흐름에서 빠졌다(_workspace/03_capture_flow.md).
 *
 * 남은 것은 두 가지뿐이다 — 이름, 그리고 커버 사진.
 */

const COVER_GROUP_ID = 'cover_preset'
const COVER_GROUP_LABEL = '커버 사진'

/** 직접 올릴 수 있는 사진 형식. covers 버킷 설정과 같은 값이다. */
const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'

export function RoomForm({
  /**
   * 제목 줄. 서버에서 그린 것을 그대로 받아 스크롤 칸 맨 위에 놓는다.
   * 글자뿐인 부분까지 클라이언트 번들에 넣을 이유가 없다.
   */
  children,
}: {
  children?: React.ReactNode
}) {
  const [state, formAction, pending] = useActionState<
    CreateRoomState,
    FormData
  >(createRoom, null)

  const [name, setName] = useState('')

  /** 고른 프리셋. 캡처 06처럼 첫 타일이 미리 골라져 있다. */
  const [preset, setPreset] = useState<CoverPreset>(COVER_PRESET_LIST[0].key)

  /** 직접 올리기로 고른 뒤 자르기를 기다리는 원본. */
  const [pickedFile, setPickedFile] = useState<File | null>(null)

  /** 자르기까지 끝난 커버. 있으면 프리셋 대신 이것이 쓰인다. */
  const [cropped, setCropped] = useState<{
    file: File
    preview: string
  } | null>(null)

  /** 토스트를 다시 띄우려면 key가 바뀌어야 한다(Toast는 마운트될 때 한 번만 센다). */
  const [toast, setToast] = useState<{ key: number; message: string } | null>(
    null,
  )

  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 잘라낸 파일을 폼에 실어 보내는 통로.
   *
   * File은 value로 넣을 수 없어서(보안상 브라우저가 막는다) DataTransfer로
   * 진짜 파일 목록을 만들어 넣는다. 이렇게 해야 <form action={...}>이
   * multipart로 그대로 실어 보낸다 — 우리가 fetch를 직접 짤 필요가 없다.
   */
  const croppedInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const input = croppedInputRef.current
    if (!input) return

    const transfer = new DataTransfer()
    if (cropped) transfer.items.add(cropped.file)
    input.files = transfer.files
  }, [cropped])

  const nameError = state?.field === 'name' ? state.error : null
  const coverError = state?.field === 'cover' ? state.error : null
  const formError = state && !state.field ? state.error : null

  const canSubmit = name.trim().length > 0

  function handlePick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) setPickedFile(file)
    // 같은 사진을 다시 골라도 change가 일어나야 하므로 값을 비운다.
    event.target.value = ''
  }

  function removeCropped() {
    setCropped(null)
    setPreset(COVER_PRESET_LIST[0].key)
  }

  return (
    /*
      캡처 06처럼 [앨범방 만들기]가 화면 아래에 고정된다.
      그래서 폼이 곧 3단(스크롤 칸 + 고정 줄)이 된다 —
      버튼을 폼 밖에 두면 제출과 이어지지 않으므로 폼이 둘 다 감싼다.
    */
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-screen-x pt-2 pb-screen-b">
          {children}

          <Field
            id="name"
            name="name"
            label="앨범방 이름"
            placeholder="예: 우리 가족 행복방"
            maxLength={ROOM_NAME_MAX_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="off"
            required
            error={nameError}
            labelSuffix={`${name.length}/${ROOM_NAME_MAX_LENGTH}`}
          />

          <FieldShell
            id={COVER_GROUP_ID}
            label={COVER_GROUP_LABEL}
            error={coverError}
          >
            {/*
              캡처는 프리셋이 실사진이지만 우리는 저작권이 정리된 사진이 없다.
              그래서 기존 그라데이션 프리셋 6종을 타일로 쓴다 (_workspace/01_home_port.md 기록).
              맨 뒤에 [직접 올리기] 타일이 붙고, 직접 올린 사진이 생기면 그 타일이 사진으로 바뀐다.
            */}
            <div
              id={COVER_GROUP_ID}
              role="radiogroup"
              aria-label={COVER_GROUP_LABEL}
              className="grid grid-cols-4 gap-3"
            >
              {COVER_PRESET_LIST.map(({ key, label, gradient }) => {
                // 직접 올린 사진이 있으면 그것이 커버다. 프리셋은 아무도 안 골라진 상태가 된다.
                const checked = !cropped && preset === key

                return (
                  <label
                    key={key}
                    className={[
                      'relative flex aspect-square cursor-pointer items-end justify-center',
                      'overflow-hidden rounded-inner border-2 transition-colors',
                      'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary',
                      checked ? 'border-primary' : 'border-transparent',
                    ].join(' ')}
                    style={{ backgroundImage: gradient }}
                  >
                    <input
                      type="radio"
                      name="cover_preset"
                      value={key}
                      checked={checked}
                      onChange={() => {
                        setPreset(key)
                        setCropped(null)
                      }}
                      className="sr-only"
                    />

                    {/* 고른 칸을 테두리 색으로만 알리지 않는다 — 체크 표시가 함께 붙는다. */}
                    <span className="sr-only">{label}</span>
                    {checked ? (
                      <span
                        aria-hidden
                        className="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white"
                      >
                        <CheckIcon />
                      </span>
                    ) : null}
                  </label>
                )
              })}

              {cropped ? (
                /* 직접 올린 사진이 마지막 타일이 된다 (캡처 08). */
                <div className="relative aspect-square rounded-inner border-2 border-primary">
                  {/*
                    next/image를 쓰지 않는다. 이건 방금 브라우저에서 만든 data: 주소라
                    최적화 서버가 손댈 것이 없고, 오히려 원격 주소로 오해받는다.
                  */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cropped.preview}
                    alt="직접 올린 커버 사진"
                    className="h-full w-full rounded-[10px] object-cover"
                  />
                  {/*
                    − 배지로 지운다(캡처 08). 44px 터치 목표를 지키되
                    보이는 동그라미는 타일을 가리지 않게 작게 둔다.
                  */}
                  <button
                    type="button"
                    onClick={removeCropped}
                    aria-label="올린 커버 사진 지우기"
                    className="absolute -top-2 -right-2 flex h-11 w-11 items-center justify-center"
                  >
                    <span
                      aria-hidden
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white shadow-chip"
                    >
                      <MinusIcon />
                    </span>
                  </button>
                </div>
              ) : (
                /* [직접 올리기] 타일 (캡처 06). label이라 키보드로도 파일 고르기가 열린다. */
                <label
                  className={[
                    'flex aspect-square cursor-pointer flex-col items-center justify-center gap-1',
                    'rounded-inner border-2 border-dashed border-hairline-strong bg-card text-primary',
                    'focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary',
                    'active:bg-primary-soft',
                  ].join(' ')}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_IMAGE_TYPES}
                    onChange={handlePick}
                    className="sr-only"
                  />
                  <CameraIcon />
                  <span className="text-center text-sm leading-tight font-bold">
                    직접
                    <br />
                    올리기
                  </span>
                </label>
              )}
            </div>

            {/*
              잘라낸 파일이 실려 나가는 칸. 화면에는 안 보이지만 폼의 일부다.
              위 미리보기와 달리 이건 서버로 가는 진짜 데이터다.
            */}
            <input
              ref={croppedInputRef}
              type="file"
              name="cover_file"
              accept={ACCEPTED_IMAGE_TYPES}
              tabIndex={-1}
              aria-hidden
              className="hidden"
            />
          </FieldShell>

          {formError ? (
            <p role="alert" className="text-base text-primary">
              {formError}
            </p>
          ) : null}
        </div>
      </div>

      {/*
        아래 고정 줄 (캡처 06·09). 이름이 비면 흐리게, 차면 또렷하게.
        aria-disabled가 아니라 disabled를 쓰는 이유 — 눌러도 아무 일이 없는 버튼보다
        "아직 못 누른다"가 분명한 편이 낫다. 무엇이 모자란지는 바로 위 이름 칸이 말해준다.
      */}
      <div className="shrink-0 border-t border-hairline bg-card px-screen-x py-3">
        <div className="mx-auto w-full max-w-md">
          <Button
            type="submit"
            fullWidth
            disabled={!canSubmit}
            pending={pending}
            pendingText="만드는 중…"
          >
            앨범방 만들기
          </Button>
        </div>
      </div>

      {pickedFile ? (
        <CoverCropDialog
          file={pickedFile}
          onCancel={() => setPickedFile(null)}
          onConfirm={(file, preview) => {
            setCropped({ file, preview })
            setPickedFile(null)
            setToast({
              key: Date.now(),
              message: '앨범방 규격에 맞춰 커버사진을 담았어요 🖼',
            })
          }}
        />
      ) : null}

      {toast ? (
        <Toast
          key={toast.key}
          message={toast.message}
          offsetClassName="bottom-28"
        />
      ) : null}
    </form>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5 5L19 7" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
    >
      <path d="M6 12h12" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8.5h3l1.4-2h7.2L17 8.5h3v10H4z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  )
}
