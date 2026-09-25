import { attemptKey, decodeAttempt } from '../../lib/attempt-storage'
import { reduceAttempt } from '../../lib/attempt'
import type { QuestionAnswer } from '../../models/attempt'
import type { PracticeRepository } from './practice-context'
import { LocalPracticeCache, type CachedPractice } from './practice-cache'
import type { PracticeRecord } from './practice-repository'
import { PersistenceError } from './repositories'
import { sameAttempt } from './sync'

function nextClientTime(startedAt: string, updatedAt: string): string {
  return new Date(Math.max(Date.now(), Date.parse(startedAt) + 1, Date.parse(updatedAt) + 1)).toISOString()
}

export function createPracticeStore(initial: PracticeRecord, repo: PracticeRepository, cache: LocalPracticeCache, delay = 800) {
  if (!initial.quiz || !initial.attempt || initial.row.status !== 'draft') throw new PersistenceError('invalid')
  const quiz = initial.quiz
  let value: CachedPractice = { id: initial.id, attempt: initial.attempt, version: initial.version }
  let notice: string | null = null
  try { value = cache.reconcile(initial) }
  catch { notice = '無法讀取本機進度；雲端草稿仍可使用。請檢查瀏覽器儲存空間。' }
  let remoteRecord = initial
  let dirty = !sameAttempt(value.attempt, initial.attempt)
  let snapshot = { attempt: value.attempt, attemptId: initial.id, notice, syncing: false, legacy: false,
    pendingSubmission: value.attempt.status === 'submitted' && remoteRecord.row.status !== 'submitted' }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null
  let active = true
  const emit = () => { snapshot = { ...snapshot, attempt: value.attempt,
    pendingSubmission: value.attempt.status === 'submitted' && remoteRecord.row.status !== 'submitted' }
    listeners.forEach((listener) => listener()) }
  const persist = () => { try { cache.write(value) } catch { snapshot = { ...snapshot, notice: '無法儲存本機進度；請保持連線並重試雲端同步。' } } }
  const problem = (error: unknown) => error instanceof PersistenceError && error.kind === 'invalid'
    ? '作答資料格式不符，已停止同步並保留本機內容。'
    : error instanceof PersistenceError && error.kind === 'conflict'
      ? '雲端草稿已變更；本機內容仍保留。請重試同步並檢查答案。'
      : '目前無法同步至雲端，作答內容已暫存於此裝置。'

  async function flush(): Promise<void> {
    if (!active) return
    if (running) return running
    clearTimeout(timer)
    snapshot = { ...snapshot, syncing: true }; emit()
    running = (async () => {
      try {
        const incoming = await repo.loadAttempt(initial.id)
        if (!active) return
        if (!incoming || !incoming.attempt || !incoming.quiz) throw new PersistenceError('conflict')
        remoteRecord = incoming
        if (incoming.row.status !== 'draft') {
          value = cache.reconcile(incoming); dirty = false; emit(); return
        }
        if (value.version.updatedAt !== incoming.version.updatedAt) {
          value = cache.reconcile(incoming)
          dirty = !sameAttempt(value.attempt, incoming.attempt)
          emit()
        }
        while (active && dirty) {
          const saving = value.attempt
          const saved = await repo.saveDraft({ ...remoteRecord, version: value.version }, saving)
          if (!active) return
          if (!saved.version) throw new PersistenceError('invalid')
          value = { ...value, version: saved.version }
          remoteRecord = { ...remoteRecord, row: { ...remoteRecord.row,
            status: saving.status === 'submitted' ? 'submitted' : 'draft' }, version: saved.version, attempt: saving }
          dirty = !sameAttempt(value.attempt, saving)
          persist(); emit()
        }
        if (snapshot.notice?.includes('無法同步')) snapshot = { ...snapshot, notice: null }
      } catch (error) { persist(); snapshot = { ...snapshot, notice: problem(error) } }
      finally { running = null; snapshot = { ...snapshot, syncing: false }; if (active) emit() }
    })()
    return running
  }
  try { snapshot.legacy = cache.storage().getItem(attemptKey(quiz.id)) !== null } catch { /* Storage unavailable. */ }
  if (dirty) timer = setTimeout(() => { void flush() }, delay)

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    start: () => { active = true; if (dirty) { clearTimeout(timer); timer = setTimeout(() => { void flush() }, delay) } },
    stop: () => { active = false; clearTimeout(timer) },
    retry: flush,
    answer(questionId: string, answer: QuestionAnswer) {
      if (!active || value.attempt.status !== 'in-progress') return
      const next = reduceAttempt(quiz, value.attempt, { type: 'answer', questionId, answer,
        now: nextClientTime(value.attempt.startedAt, value.attempt.updatedAt) })
      if (next === value.attempt) return
      value = { ...value, attempt: next }; dirty = true; persist(); emit()
      clearTimeout(timer); timer = setTimeout(() => { void flush() }, delay)
    },
    async submit(): Promise<string | null> {
      clearTimeout(timer)
      if (running) await running
      if (value.attempt.status !== 'in-progress') return null
      try {
        const incoming = await repo.loadAttempt(initial.id)
        if (!incoming || incoming.row.status !== 'draft' || !incoming.attempt) throw new PersistenceError('conflict')
        if (value.version.updatedAt !== incoming.version.updatedAt) {
          const previous = value.attempt
          value = cache.reconcile(incoming)
          dirty = !sameAttempt(value.attempt, incoming.attempt)
          if (!sameAttempt(previous, value.attempt)) {
            snapshot = { ...snapshot, notice: '雲端草稿已更新，請確認目前答案後再提交。' }; emit(); return null
          }
        }
        const submitted = reduceAttempt(quiz, value.attempt, { type: 'submit',
          now: nextClientTime(value.attempt.startedAt, value.attempt.updatedAt) })
        const saved = await repo.saveDraft({ ...incoming, version: value.version }, submitted)
        if (!saved.version) throw new PersistenceError('invalid')
        value = { ...value, attempt: submitted, version: saved.version }; dirty = false
        persist(); emit(); return initial.id
      } catch (error) { snapshot = { ...snapshot, notice: problem(error) }; emit(); return null }
    },
    async deleteDraft(): Promise<boolean> {
      clearTimeout(timer)
      if (running) await running
      try {
        const incoming = await repo.loadAttempt(initial.id)
        if (!incoming || incoming.row.status !== 'draft' || incoming.version.updatedAt !== value.version.updatedAt) throw new PersistenceError('conflict')
        await repo.deleteDraft(incoming)
        cache.removeDraft(value)
        active = false
        return true
      } catch (error) { snapshot = { ...snapshot, notice: problem(error) }; emit(); return false }
    },
    async importLegacy(): Promise<void> {
      try {
        const raw = cache.storage().getItem(attemptKey(quiz.id))
        const legacy = raw && decodeAttempt(raw, quiz)
        if (!legacy || value.attempt.status !== 'in-progress' || Object.keys(value.attempt.answers).length) throw new Error('Cannot import')
        const now = nextClientTime(value.attempt.startedAt, value.attempt.updatedAt)
        const imported = legacy.status === 'submitted'
          ? { ...legacy, startedAt: value.attempt.startedAt, updatedAt: now, submittedAt: now }
          : { ...legacy, startedAt: value.attempt.startedAt, updatedAt: now }
        if (imported.status === 'submitted') {
          const saved = await repo.saveDraft(remoteRecord, imported)
          if (!saved.version) throw new PersistenceError('invalid')
          value = { ...value, attempt: imported, version: saved.version }; dirty = false; persist(); emit()
        } else { value = { ...value, attempt: imported }; dirty = true; persist(); emit(); await flush() }
      } catch { snapshot = { ...snapshot, notice: '無法匯入舊版進度；原始資料仍保留。' }; emit() }
    },
  }
}
