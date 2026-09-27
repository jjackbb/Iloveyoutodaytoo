import { createDemoSeed, isDemoSnapshot, type DemoSnapshot } from './model'

/** 다른 앱·인증 정보와 분리된 데모 전용 저장소. */
export const DEMO_DB_NAME = 'oneuldo-portfolio-demo-v1'
const STORE = 'snapshot'
const KEY = 'current'

/** 초기화로 풀리는 문제(저장 기록 손상)와 풀리지 않는 문제(저장소 접근 불가)를 구분한다. */
export class DemoStorageError extends Error {
  constructor(message: string, readonly resettable: boolean) {
    super(message)
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new DemoStorageError('이 브라우저에서는 체험 내용을 저장할 수 없어요. 다른 브라우저에서 열어주세요.', false))
      return
    }
    const request = indexedDB.open(DEMO_DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onerror = () => reject(new DemoStorageError('브라우저 저장 공간을 열지 못했어요. 저장 권한을 확인해주세요.', false))
    request.onblocked = () => reject(new DemoStorageError('다른 체험 창을 닫고 다시 시도해주세요.', false))
    request.onsuccess = () => resolve(request.result)
  })
}

/** 읽기-수정-쓰기를 한 트랜잭션으로 묶고, 디스크 반영 후에만 성공한다. */
export async function updateDemo(
  change: (current: DemoSnapshot) => DemoSnapshot = (current) => current,
  reset = false,
): Promise<DemoSnapshot> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite')
    const store = transaction.objectStore(STORE)
    const request = store.get(KEY)
    let next: DemoSnapshot
    let failure: Error | null = null
    request.onsuccess = () => {
      try {
        let value: unknown = request.result
        // 초기 데모의 단일 즐겨찾기를 기록 삭제 없이 인물별 설정으로 옮긴다.
        if (value && typeof value === 'object' && 'favorite' in value && typeof value.favorite === 'boolean') {
          const old = value as { favorite: boolean; actor?: string }
          value = { ...value, favorite: { child: old.actor !== 'parent' && old.favorite, parent: old.actor === 'parent' && old.favorite } }
        }
        if (!reset && value !== undefined && !isDemoSnapshot(value)) throw new DemoStorageError('저장된 체험 내용을 읽지 못했어요. 예시로 초기화하면 다시 시작할 수 있어요.', true)
        const current = reset || value === undefined ? createDemoSeed() : value as DemoSnapshot
        next = change(current)
        if (!isDemoSnapshot(next)) throw new Error('저장할 내용을 확인하지 못했어요. 입력은 그대로 두었어요.')
        store.put(next, KEY)
      } catch (cause) {
        failure = cause instanceof DOMException
          ? new Error(cause.name === 'QuotaExceededError'
            ? '브라우저 저장 공간이 부족해요. 사진 수를 줄이거나 예시로 초기화해주세요.'
            : '체험 내용을 저장하지 못했어요. 입력은 유지돼요. 다시 시도해주세요.')
          : cause instanceof Error ? cause : new Error('체험 내용을 저장하지 못했어요.')
        transaction.abort()
      }
    }
    transaction.oncomplete = () => { db.close(); resolve(next) }
    transaction.onabort = () => {
      db.close()
      reject(failure ?? new Error(transaction.error?.name === 'QuotaExceededError'
        ? '브라우저 저장 공간이 부족해요. 사진 수를 줄이거나 예시로 초기화해주세요.'
        : '저장하지 못했어요. 입력은 유지돼요. 잠시 후 다시 시도해주세요.'))
    }
    transaction.onerror = () => { /* onabort에서 한 번만 처리 */ }
  })
}
