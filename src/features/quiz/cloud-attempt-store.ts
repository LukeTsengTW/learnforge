import { createAttempt, reduceAttempt, type AttemptAction } from '../../lib/attempt'
import { attemptKey, decodeAttempt } from '../../lib/attempt-storage'
import type { Quiz } from '../../models/quiz'
import { LocalAttemptRepository, PersistenceError, type AttemptRepository, type StoredAttempt } from './repositories'
import { resolveAttemptConflict, sameAttempt } from './sync'

export const SYNC_WARNING = '目前無法同步至雲端，作答內容已暫存於此裝置。'
export function createCloudAttemptStore(quiz: Quiz, local: LocalAttemptRepository, remote: AttemptRepository, delay = 800) {
  let value: StoredAttempt = { attempt: createAttempt(quiz, new Date().toISOString()), version: null }
  let notice: string | null = null
  let blocked = false
  try { value = local.read() ?? value } catch (error) {
    if (error instanceof PersistenceError && error.kind === 'invalid') {
      try { local.preserveRaw(); notice = '本機進度格式不符，原始資料已另存 recovery 備份，將嘗試載入雲端進度。' }
      catch { notice = '本機資料無法備份，為保留原始資料已暫停作答。請釋放儲存空間並重新整理。'; blocked = true }
    } else notice = '無法讀取本機暫存，將嘗試載入雲端進度。請保持連線。'
  }
  let snapshot = { attempt: value.attempt, notice, loading: true, syncing: false, legacy: false }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let active = false
  let initialized = false
  let running: Promise<void> | null = null
  let dirty = false
  const emit = () => { snapshot = { ...snapshot, attempt: value.attempt }; listeners.forEach(fn => fn()) }
  const persist = () => {
    try { local.write(value); return true } catch { snapshot = { ...snapshot, notice: '無法儲存本機進度，請勿關閉此頁；可重試雲端同步。' }; return false }
  }
  function archive(losing: StoredAttempt) {
    local.archive(losing) // If backup fails, abort reconciliation and preserve the in-memory/local original.
    snapshot = { ...snapshot, notice: '已採用雲端版本；衝突的本機作答已另存為此裝置的 recovery 備份。' }
  }
  function reconcile(incoming: StoredAttempt | null) {
    const previous = value
    if (!incoming) {
      if (value.version) { archive(value); value = { attempt: createAttempt(quiz, new Date().toISOString()), version: null }; dirty = false }
      else dirty = Object.keys(value.attempt.answers).length > 0 || value.attempt.status === 'submitted'
    } else {
      const otherGeneration = value.version !== null && value.version.id !== incoming.version?.id
      const emptyLocal = !value.version && value.attempt.status === 'in-progress' && !Object.keys(value.attempt.answers).length
      if (emptyLocal || otherGeneration || resolveAttemptConflict(value.attempt, incoming.attempt) === 'remote') {
        if (!sameAttempt(value.attempt, incoming.attempt) && (Object.keys(value.attempt.answers).length || value.attempt.status === 'submitted')) archive(value)
        value = incoming; dirty = false
      } else {
        // Preserve an independently edited remote draft before the documented newer-local rule replaces it.
        if (!sameAttempt(value.attempt, incoming.attempt) && value.version?.updatedAt !== incoming.version?.updatedAt
          && Object.keys(incoming.attempt.answers).length) {
          local.archive(incoming)
          snapshot = { ...snapshot, notice: '本機作答較新；衝突的雲端草稿已另存為此裝置的 recovery 備份。' }
        }
        value = { ...value, version: incoming.version }; dirty = !sameAttempt(value.attempt, incoming.attempt)
      }
    }
    if (previous !== value) persist()
  }
  async function flush() {
    if (!active || blocked || snapshot.loading) return
    if (running) return running
    clearTimeout(timer)
    snapshot = { ...snapshot, syncing: true }; emit()
    running = (async () => {
      try {
        // Reload before writing: detects cross-device restart, immutable submission and stale versions.
        const incoming = await remote.load()
        if (!active) return
        reconcile(incoming)
        while (active && dirty) {
          const saving = value
          const saved = await remote.save(saving)
          if (!active) return
          value = { ...value, version: saved.version }
          dirty = !sameAttempt(value.attempt, saving.attempt)
          persist()
        }
        if (snapshot.notice === SYNC_WARNING) snapshot = { ...snapshot, notice: null }
      } catch (error) {
        const cached = persist()
        snapshot = { ...snapshot, notice: error instanceof PersistenceError && error.kind === 'invalid'
          ? '雲端作答格式不符，已停止同步並保留本機內容。請聯絡專案維護者。'
          : error instanceof PersistenceError && error.kind === 'conflict'
            ? '雲端版本已變更，本機內容已保留。請重試同步以取得最新版本。'
            : cached ? SYNC_WARNING : snapshot.notice }
      } finally { running = null; snapshot = { ...snapshot, syncing: false }; if (active) emit() }
    })()
    return running
  }
  async function start() {
    active = true
    if (initialized) { void flush(); return }
    initialized = true
    try {
      const incoming = await remote.load()
      if (!active) { initialized = false; return }
      if (!blocked) reconcile(incoming)
    } catch (error) { snapshot = { ...snapshot, notice: error instanceof PersistenceError && error.kind === 'invalid'
      ? '雲端作答格式不符，已保留原始資料並停止同步。' : SYNC_WARNING } }
    finally {
      if (active) {
        let legacy = false
        try { legacy = local.storage().getItem(attemptKey(quiz.id)) !== null } catch { /* Storage unavailable. */ }
        snapshot = { ...snapshot, loading: false, legacy }; emit()
        if (dirty) void flush()
      }
    }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    start,
    stop: () => { active = false; clearTimeout(timer) },
    retry: flush,
    dispatch(action: AttemptAction) {
      if (snapshot.loading || blocked || action.type === 'restart') return
      const attempt = reduceAttempt(quiz, value.attempt, action)
      if (attempt === value.attempt) return
      value = { ...value, attempt }; dirty = true; persist(); emit()
      clearTimeout(timer)
      timer = setTimeout(() => { void flush() }, action.type === 'submit' ? 0 : delay)
    },
    async restart(): Promise<boolean> {
      clearTimeout(timer)
      if (running) await running
      try {
        if (blocked) throw new PersistenceError('invalid')
        await remote.delete(value.version)
        await local.delete()
        value = { attempt: createAttempt(quiz, new Date().toISOString()), version: null }; dirty = false
        snapshot = { ...snapshot, notice: null }; emit(); return true
      } catch { snapshot = { ...snapshot, notice: '重新開始失敗，原本作答仍保留。請連線並重試同步後再重新開始。' }; emit(); return false }
    },
    async importLegacy() {
      try {
        const raw = local.storage().getItem(attemptKey(quiz.id))
        const legacy = raw && decodeAttempt(raw, quiz)
        if (!legacy || value.version || Object.keys(value.attempt.answers).length) throw new Error('Cannot import')
        value = { attempt: legacy, version: null }; dirty = true
        persist(); emit(); await flush()
      } catch { snapshot = { ...snapshot, notice: '無法匯入：目前帳號已有進度，或舊版資料不符合本測驗。舊資料仍保留。' }; emit() }
    },
  }
}
