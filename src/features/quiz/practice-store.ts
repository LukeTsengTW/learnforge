import { attemptKey, decodeAttempt } from '../../lib/attempt-storage'
import { reduceAttempt } from '../../lib/attempt'
import { answerQuizDraftV4, draftAnswerMapBytes, draftAnswerProblemV4, isLegacyQuestionAnswer, upgradeLegacyQuizDraftV4 } from '../../lib/draft-v4'
import { answerQuizDraftV5, draftAnswerMapBytesV5, draftAnswerProblemV5, promoteQuizDraftV5, requiresV5Draft } from '../../lib/draft-v5'
import type { DraftSchemaVersion, PracticeAnswer, PracticeAnswerV5, PracticeAttempt } from '../../models/draft-v4'
import type { Quiz } from '../../models/quiz'
import type { AnswerOutcome, SubmitProgress, SubmitStage } from './attempt-context'
import type { PracticeRepository } from './practice-context'
import { LocalPracticeCache } from './practice-cache'
import { expectedGradingVersion, SubmissionError, type PracticeRecord } from './practice-repository'
import { PersistenceError, type RemoteVersion } from './repositories'
import { sameAttempt } from './sync'

interface StoreValue { id: string; attempt: PracticeAttempt; version: RemoteVersion; recoveryExpectedVersion?: string }

const isSchema2Answer = (answer: PracticeAnswerV5): answer is PracticeAnswer =>
  answer.type !== 'calculation' || !('pages' in answer)

function nextClientTime(startedAt: string, updatedAt: string): string {
  return new Date(Math.max(Date.now(), Date.parse(startedAt) + 1, Date.parse(updatedAt) + 1)).toISOString()
}

export const SCHEMA_CHANGED_NOTICE = '此草稿已由新版頁面更新為新的作答格式；本機內容已保留。請重新整理頁面後繼續。'
export const INVALID_SUBMISSION_NOTICE = '作答內容不符合正式提交限制，請檢查答案後再試。'
export const STALE_DRAFT_NOTICE = '雲端草稿已由其他分頁或裝置更新，已改用雲端版本；你在此頁的未同步變更已保留於本機練習備份。'
export const DRAFT_CHANGED_NOTICE = '雲端草稿已更新，請確認目前答案後再提交。'
export const STALE_NOT_SUBMITTED_NOTICE = `${STALE_DRAFT_NOTICE}作答尚未提交，請確認目前答案後再提交。`
export const DRAFT_FULL_NOTICE = '整份作答已達雲端草稿的大小上限，剛才的變更沒有套用。請先復原或清除部分手寫筆畫（任何一題皆可）再繼續。'

/**
 * Draft schema is decided once from the EXACT revision and server marker. Paged-capable revisions
 * use schema 3 and promote older in-progress drafts in memory; historical submissions stay intact.
 */
export function draftSchemaFor(record: PracticeRecord, quiz: Quiz): DraftSchemaVersion {
  const capable = requiresV5Draft(quiz)
  if (record.schemaVersion > 1 && !capable) throw new PersistenceError('invalid')
  return capable ? 3 : 1
}

/**
 * The remote attempt seen through this store's schema. No server write happens here: a schema-1
 * draft of a v4-capable revision is promoted purely in memory; a failed promotion is surfaced.
 */
export function effectiveRemoteAttempt(record: PracticeRecord, quiz: Quiz, schema: DraftSchemaVersion): PracticeAttempt {
  const attempt = record.attempt
  if (!attempt) throw new PersistenceError('conflict')
  if (schema === 1) {
    if (record.schemaVersion !== 1 || attempt.schemaVersion !== 1) throw new PersistenceError('invalid')
    return attempt
  }
  if (schema === 3) {
    if (record.schemaVersion === 3) {
      if (attempt.schemaVersion !== 3) throw new PersistenceError('invalid')
      return attempt
    }
    if (record.schemaVersion === 2 && attempt.schemaVersion === 2) {
      if (attempt.status === 'submitted') return attempt
      const promoted = promoteQuizDraftV5(attempt, quiz)
      if (!promoted) throw new PersistenceError('invalid')
      return promoted
    }
    if (record.schemaVersion === 1 && attempt.schemaVersion === 1) {
      if (attempt.status === 'submitted') return attempt
      const promoted = promoteQuizDraftV5(attempt, quiz)
      if (!promoted) throw new PersistenceError('invalid')
      return promoted
    }
    throw new PersistenceError('invalid')
  }
  if (record.schemaVersion === 2) {
    if (attempt.schemaVersion !== 2) throw new PersistenceError('invalid')
    return attempt
  }
  if (attempt.schemaVersion !== 1) throw new PersistenceError('invalid')
  // Submitted by an older schema-1 tab: authoritative as-is (it is never rewritten).
  if (attempt.status === 'submitted') return attempt
  const promoted = upgradeLegacyQuizDraftV4(attempt, quiz)
  if (!promoted) throw new PersistenceError('invalid')
  return promoted
}

export function createPracticeStore(initial: PracticeRecord, repo: PracticeRepository, cache: LocalPracticeCache, delay = 800) {
  if (!initial.quiz || !initial.attempt || initial.row.status !== 'draft') throw new PersistenceError('invalid')
  const quiz = initial.quiz
  const schema = draftSchemaFor(initial, quiz)
  const v4Cache = cache.forV4()
  const v5Cache = cache.forV5()
  const remoteAttempt = (record: PracticeRecord) => effectiveRemoteAttempt(record, quiz, schema)

  function reconcile(record: PracticeRecord): StoreValue {
    if (schema === 1) return cache.reconcile(record)
    const remote = remoteAttempt(record)
    if (schema === 3) {
      if (remote.schemaVersion === 3 && remote.status === 'in-progress') {
        return v5Cache.reconcile(record, remote)
      }
      const local = (() => { try { return v5Cache.read(record.id, quiz) } catch { return null } })()
      if (local) { v5Cache.archive(local, '其他裝置或分頁已提交'); v5Cache.removeDraft(local) }
      return { id: record.id, attempt: remote, version: record.version }
    }
    if (remote.schemaVersion === 2) return v4Cache.reconcile(record, remote)
    // Only a submitted schema-1 record reaches here: keep any local v4 draft as recovery evidence.
    const local = (() => { try { return v4Cache.read(record.id, quiz) } catch { return null } })()
    if (local) { v4Cache.archive(local, '其他裝置或分頁已提交'); v4Cache.removeDraft(local) }
    return { id: record.id, attempt: remote, version: record.version }
  }
  function writeCache(next: StoreValue) {
    const attempt = next.attempt
    if (attempt.schemaVersion === 3 && attempt.status === 'in-progress') v5Cache.write({ ...next, attempt })
    else if (attempt.schemaVersion === 2) v4Cache.write({ ...next, attempt })
    else if (schema === 1 && attempt.schemaVersion === 1) cache.write({ ...next, attempt })
    // A schema-2 store never writes a schema-1 attempt into either namespace.
  }
  function archiveCache(next: StoreValue, reason: string) {
    const attempt = next.attempt
    if (attempt.schemaVersion === 3 && attempt.status === 'in-progress') v5Cache.archive({ ...next, attempt }, reason)
    else if (attempt.schemaVersion === 2) v4Cache.archive({ ...next, attempt }, reason)
    else if (attempt.schemaVersion === 1) cache.archive({ ...next, attempt }, reason)
  }

  let value: StoreValue = { id: initial.id, attempt: remoteAttempt(initial), version: initial.version }
  let notice: string | null = null
  try { value = reconcile(initial) }
  catch { notice = '無法讀取本機進度；雲端草稿仍可使用。請檢查瀏覽器儲存空間。' }
  let remoteRecord = initial
  let dirty = !sameAttempt(value.attempt, remoteAttempt(initial))
  // Size of the answers as the save path measures it; schema-1 drafts have no aggregate cap.
  const draftBytes = (attempt: PracticeAttempt) => attempt.schemaVersion === 3 ? draftAnswerMapBytesV5(attempt.answers)
    : attempt.schemaVersion === 2 ? draftAnswerMapBytes(attempt.answers) : 0
  let snapshot = { attempt: value.attempt, attemptId: initial.id, notice, syncing: false, submitting: false,
    submitProgress: null as SubmitProgress | null, legacy: false,
    draftSchema: schema, pendingSubmission: value.attempt.status === 'submitted' && remoteRecord.row.status !== 'submitted',
    draftBytes: draftBytes(value.attempt) }
  const listeners = new Set<() => void>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: Promise<void> | null = null
  let submitting = false
  let submissionRequestId: string | null = null
  let active = true
  let schemaChanged = false
  // Drafts this store sent whose result it never saw (the response was lost or the store was inactive).
  // The server may hold exactly one of them under a generation this store does not know yet.
  let unconfirmedSaves: PracticeAttempt[] = []
  const emit = () => { snapshot = { ...snapshot, attempt: value.attempt, draftBytes: draftBytes(value.attempt),
    pendingSubmission: value.attempt.status === 'submitted' && remoteRecord.row.status !== 'submitted' }
    listeners.forEach((listener) => listener()) }
  const persist = () => { try { writeCache(value) } catch {
    try { archiveCache(value, '另一分頁已提交或本機儲存衝突') } catch { /* Keep the current in-memory answers. */ }
    snapshot = { ...snapshot, notice: '無法儲存本機進度；請保持連線並重試雲端同步。' }
  } }
  const problem = (error: unknown) => schemaChanged ? SCHEMA_CHANGED_NOTICE
    : error instanceof PersistenceError && error.kind === 'invalid'
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
        if (schemaChanged) throw new PersistenceError('conflict')
        const incoming = await repo.loadAttempt(initial.id)
        if (!active) return
        if (!incoming || !incoming.attempt || !incoming.quiz) throw new PersistenceError('conflict')
        if (schema < incoming.schemaVersion) {
          // Another (newer) client promoted this draft. Never downgrade: keep local work, stop syncing.
          schemaChanged = true
          archiveCache(value, '雲端草稿已升級為新的作答格式')
          throw new PersistenceError('conflict')
        }
        remoteRecord = incoming
        const remote = remoteAttempt(incoming)
        if (incoming.row.status !== 'draft') {
          if (!sameAttempt(value.attempt, remote)) archiveCache(value, '其他裝置或分頁已提交')
          value = reconcile(incoming); dirty = false; emit(); return
        }
        if (value.version.updatedAt !== incoming.version.updatedAt) {
          if (unconfirmedSaves.some((sent) => sameAttempt(remote, sent))) {
            // The new server generation is this store's own earlier save, applied without the store
            // seeing the result. It is an ancestor of the local draft, not another client's work:
            // adopt the generation and keep the newer local answers, which are saved below.
            value = { ...value, version: incoming.version }
            dirty = !sameAttempt(value.attempt, remote)
            persist(); emit()
          } else {
            const staleLocalWork = dirty
            if (schema > 1) {
              // Keep stale local work in its versioned cache; reconcile archives it and keeps the new
              // server generation active without rebinding to its CAS token.
              if (staleLocalWork) persist()
            } else if (staleLocalWork) archiveCache(value, '同步時發現另一個草稿版本')
            value = reconcile(incoming)
            dirty = !sameAttempt(value.attempt, remote)
            if (schema > 1 && staleLocalWork) snapshot = { ...snapshot, notice: STALE_DRAFT_NOTICE }
            emit()
          }
          // The server moved to a new generation: every earlier send expects an older one and fails its CAS.
          unconfirmedSaves = []
        }
        while (active && dirty) {
          const saving = value.attempt
          // Kept until a save is confirmed: an unanswered request may still reach the server later.
          unconfirmedSaves = [...unconfirmedSaves.slice(-4), saving]
          const saved = await repo.saveDraft({ ...remoteRecord, version: value.version }, saving)
          unconfirmedSaves = []
          if (!active) return
          if (!saved.version) throw new PersistenceError('invalid')
          value = { id: value.id, attempt: value.attempt, version: saved.version }
          remoteRecord = { ...remoteRecord, version: saved.version, attempt: saving, schemaVersion: saving.schemaVersion,
            row: { ...remoteRecord.row, answer_schema_version: saving.schemaVersion } }
          dirty = !sameAttempt(value.attempt, saving)
          persist(); emit()
        }
        if (snapshot.notice?.includes('無法同步')) snapshot = { ...snapshot, notice: null }
      } catch (error) { persist(); snapshot = { ...snapshot, notice: problem(error) } }
      finally { running = null; snapshot = { ...snapshot, syncing: false }; if (active) emit() }
    })()
    return running
  }
  try { snapshot.legacy = schema === 1 && cache.storage().getItem(attemptKey(quiz.id)) !== null } catch { /* Storage unavailable. */ }
  if (dirty) timer = setTimeout(() => { void flush() }, delay)

  function nextAttempt(questionId: string, answer: PracticeAnswerV5): PracticeAttempt {
    const current = value.attempt
    const now = nextClientTime(current.startedAt, current.updatedAt)
    if (current.schemaVersion === 2) {
      if (!isSchema2Answer(answer)) return current
      return current.status === 'in-progress' ? answerQuizDraftV4(quiz, current, questionId, answer, now) : current
    }
    if (current.schemaVersion === 3) {
      return current.status === 'in-progress' ? answerQuizDraftV5(quiz, current, questionId, answer, now) : current
    }
    // Schema 1 keeps its historical reducer and only ever accepts legacy answer shapes.
    if (schema !== 1 || !isSchema2Answer(answer) || !isLegacyQuestionAnswer(answer)) return current
    return reduceAttempt(quiz, current, { type: 'answer', questionId, answer, now })
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    start: () => { active = true; if (dirty) { clearTimeout(timer); timer = setTimeout(() => { void flush() }, delay) } },
    stop: () => { active = false; clearTimeout(timer) },
    retry: flush,
    /**
     * Synchronous: the result says whether the draft now holds this answer. An editor must not keep
     * showing input that was not accepted, because formal submission serializes this draft only.
     */
    answer(questionId: string, answer: PracticeAnswerV5): AnswerOutcome {
      if (!active || submitting || schemaChanged || value.attempt.status !== 'in-progress') return 'rejected'
      const current = value.attempt
      const next = nextAttempt(questionId, answer)
      if (next === current) {
        const problem = current.schemaVersion === 3 && current.status === 'in-progress'
          ? draftAnswerProblemV5(quiz, current, questionId, answer)
          : current.schemaVersion === 2 && current.status === 'in-progress'
            ? isSchema2Answer(answer) ? draftAnswerProblemV4(quiz, current, questionId, answer) : 'invalid' : 'invalid'
        if (problem !== 'draft-oversized') return problem === 'oversized' ? 'limit' : 'rejected'
        // Typed and choice answers have no notice of their own, so the page says it as well.
        snapshot = { ...snapshot, notice: DRAFT_FULL_NOTICE }; emit()
        return 'draft-limit'
      }
      if (snapshot.notice === DRAFT_FULL_NOTICE) snapshot = { ...snapshot, notice: null }
      value = { ...value, attempt: next }; dirty = true; persist(); emit()
      submissionRequestId = null
      clearTimeout(timer); timer = setTimeout(() => { void flush() }, delay)
      return 'accepted'
    },
    /**
     * Formal submission. Callers flush pending editor input into answer() synchronously first; the
     * latest draft is then saved, CAS-checked and submitted with only requestId/attemptId/CAS.
     * Submit boundary: only the draft held at this call is ever submitted. If synchronization replaces
     * it with a different server draft, nothing is submitted and the user is asked to confirm.
     */
    async submit(): Promise<string | null> {
      if (submitting) return null
      const intended = value.attempt
      const startedAt = Date.now()
      const reach = (stage: SubmitStage, waiting = false) => {
        snapshot = { ...snapshot, submitProgress: { stage, startedAt, waiting } }; emit()
      }
      submitting = true
      snapshot = { ...snapshot, submitting: true, notice: null, submitProgress: { stage: 'save', startedAt, waiting: false } }; emit()
      clearTimeout(timer)
      try {
        if (running) await running
        if (value.attempt.status !== 'in-progress' || schemaChanged) {
          if (schemaChanged) snapshot = { ...snapshot, notice: SCHEMA_CHANGED_NOTICE }
          return null
        }
        // An explicit submit of an in-memory promoted draft performs the first v4 save (marker 1 -> 2).
        if (value.attempt.schemaVersion > remoteRecord.schemaVersion) dirty = true
        await flush()
        if (remoteRecord.row.status === 'submitted') {
          if (remoteRecord.row.submission_request_id === submissionRequestId) {
            if (remoteRecord.attempt?.status !== 'submitted') throw new SubmissionError('unavailable')
            return initial.id
          }
          throw new SubmissionError('conflict')
        }
        if (dirty) throw new SubmissionError('unavailable')
        if (!sameAttempt(value.attempt, intended)) {
          submissionRequestId = null
          snapshot = { ...snapshot, notice: snapshot.notice === STALE_DRAFT_NOTICE ? STALE_NOT_SUBMITTED_NOTICE : DRAFT_CHANGED_NOTICE }
          emit(); return null
        }
        reach('verify')
        const incoming = await repo.loadAttempt(initial.id)
        if (incoming?.row.status === 'submitted' && incoming.row.submission_request_id === submissionRequestId) {
          if (incoming.attempt?.status !== 'submitted') throw new SubmissionError('unavailable')
          value = reconcile(incoming)
          // Reconciliation archives/removes the local draft. A submitted attempt is not a draft
          // cache entry and must not be written back through the in-progress cache codec.
          remoteRecord = incoming; dirty = false; emit()
          return initial.id
        }
        if (!incoming || incoming.row.status !== 'draft' || !incoming.attempt) throw new SubmissionError('conflict')
        if (schema < incoming.schemaVersion) { schemaChanged = true; throw new SubmissionError('conflict') }
        if (value.version.updatedAt !== incoming.version.updatedAt || !sameAttempt(value.attempt, remoteAttempt(incoming))) {
          value = reconcile(incoming)
          dirty = !sameAttempt(value.attempt, remoteAttempt(incoming))
          submissionRequestId = null
          snapshot = { ...snapshot, notice: DRAFT_CHANGED_NOTICE }; emit(); return null
        }
        // A promoted-but-unsaved schema-1 draft is never submitted as v4: the v4 save must land first.
        if (value.attempt.schemaVersion !== incoming.schemaVersion) throw new SubmissionError('unavailable')
        const requestId = submissionRequestId ?? crypto.randomUUID()
        submissionRequestId = requestId
        const gradingVersion = expectedGradingVersion(incoming.schemaVersion)
        reach('grade')
        for (let poll = 0; poll < 40; poll++) {
          const result = await repo.submitDraft(initial.id, value.version.updatedAt, requestId, gradingVersion)
          if (result.state === 'submitted') {
            reach('result')
            const final = await repo.loadAttempt(initial.id).catch(() => null)
            if (final?.attempt?.status === 'submitted' && final.schemaVersion === incoming.schemaVersion) {
              value = reconcile(final)
              // Reconciliation archives/removes the local draft. Keep finalized evidence remote.
              remoteRecord = final; dirty = false; emit()
            }
            return initial.id
          }
          if (!snapshot.submitProgress?.waiting) reach('grade', true)
          await new Promise((resolve) => setTimeout(resolve, 1500))
        }
        throw new SubmissionError('unavailable')
      } catch (error) {
        if (error instanceof SubmissionError && (error.kind === 'conflict' || error.kind === 'invalid')) submissionRequestId = null
        snapshot = { ...snapshot, notice: schemaChanged ? SCHEMA_CHANGED_NOTICE
          : error instanceof SubmissionError && error.kind === 'conflict'
            ? '雲端草稿已變更，作答尚未提交。請確認答案後重試。'
            : error instanceof SubmissionError && error.kind === 'invalid' ? INVALID_SUBMISSION_NOTICE
              : 'AI 評分暫時無法完成，本次作答尚未提交，請稍後再試。' }
        emit(); return null
      } finally { submitting = false; snapshot = { ...snapshot, submitting: false, submitProgress: null }; emit() }
    },
    async deleteDraft(): Promise<boolean> {
      if (submitting) return false
      clearTimeout(timer)
      if (running) await running
      try {
        const incoming = await repo.loadAttempt(initial.id)
        if (!incoming || incoming.row.status !== 'draft' || incoming.version.updatedAt !== value.version.updatedAt) throw new PersistenceError('conflict')
        await repo.deleteDraft(incoming)
        const attempt = value.attempt
        if (attempt.schemaVersion === 3 && attempt.status === 'in-progress') v5Cache.removeDraft({ ...value, attempt })
        else if (attempt.schemaVersion === 2) v4Cache.removeDraft({ ...value, attempt })
        else if (attempt.schemaVersion === 1) cache.removeDraft({ ...value, attempt })
        active = false
        return true
      } catch (error) { snapshot = { ...snapshot, notice: problem(error) }; emit(); return false }
    },
    async importLegacy(): Promise<void> {
      try {
        const current = value.attempt
        const raw = cache.storage().getItem(attemptKey(quiz.id))
        const legacy = raw && decodeAttempt(raw, quiz)
        if (schema !== 1 || current.schemaVersion !== 1 || !legacy || current.status !== 'in-progress'
          || Object.keys(current.answers).length) throw new Error('Cannot import')
        const now = nextClientTime(current.startedAt, current.updatedAt)
        const imported = { ...legacy, status: 'in-progress' as const,
          startedAt: current.startedAt, updatedAt: now, submittedAt: undefined, result: undefined }
        value = { ...value, attempt: imported }; dirty = true; persist(); emit(); await flush()
      } catch { snapshot = { ...snapshot, notice: '無法匯入舊版進度；原始資料仍保留。' }; emit() }
    },
  }
}
