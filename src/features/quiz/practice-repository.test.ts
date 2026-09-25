import { describe, expect, it, vi } from 'vitest'
import type { AppSupabase } from '../../lib/supabase'
import { SupabasePracticeRepository } from './practice-repository'

class QueryProbe {
  calls: unknown[][] = []
  select(columns: string) { this.calls.push(['select', columns]); return this }
  eq(column: string, value: string) { this.calls.push(['eq', column, value]); return this }
  order(column: string, options: { ascending: boolean }) { this.calls.push(['order', column, options.ascending]); return this }
  range(start: number, end: number) { this.calls.push(['range', start, end]); return Promise.resolve({ data: [], error: null }) }
}

describe('history query', () => {
  it('filters to one owner and uses stable time-plus-UUID order with a 20+1 page', async () => {
    const query = new QueryProbe()
    const from = vi.fn(() => query)
    const repo = new SupabasePracticeRepository({ from } as unknown as AppSupabase, 'student')
    const page = await repo.listSubmittedPage(20)
    expect(page).toEqual({ records: [], nextOffset: null })
    expect(from).toHaveBeenCalledOnce()
    expect(from).toHaveBeenCalledWith('attempts')
    expect(query.calls).toEqual([
      ['select', '*, answers(*)'], ['eq', 'user_id', 'student'], ['eq', 'status', 'submitted'],
      ['order', 'submitted_at', false], ['order', 'id', false], ['range', 20, 40],
    ])
  })
})
