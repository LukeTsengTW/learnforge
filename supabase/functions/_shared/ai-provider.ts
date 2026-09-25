export interface ProviderUsage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
}

export class AiProviderError extends Error {
  readonly code: 'rate_limited' | 'provider_unavailable' | 'timeout' | 'malformed' | 'incomplete'
  constructor(code: AiProviderError['code']) { super(code); this.code = code }
}

const nonnegative = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0

export function parseProviderEnvelope(value: unknown): {
  kind: 'text' | 'refusal'; text: string | null; responseId: string | null; usage: ProviderUsage
} {
  if (!value || typeof value !== 'object') throw new AiProviderError('malformed')
  const body = value as Record<string, unknown>
  if (body.status === 'incomplete') throw new AiProviderError('incomplete')
  if (body.status !== 'completed' || !Array.isArray(body.output)) throw new AiProviderError('malformed')
  const usage = body.usage && typeof body.usage === 'object' ? body.usage as Record<string, unknown> : {}
  const inputDetails = usage.input_tokens_details && typeof usage.input_tokens_details === 'object'
    ? usage.input_tokens_details as Record<string, unknown> : {}
  const outputDetails = usage.output_tokens_details && typeof usage.output_tokens_details === 'object'
    ? usage.output_tokens_details as Record<string, unknown> : {}
  const metadata = { responseId: typeof body.id === 'string' ? body.id : null,
    usage: { inputTokens: nonnegative(usage.input_tokens), cachedInputTokens: nonnegative(inputDetails.cached_tokens),
      outputTokens: nonnegative(usage.output_tokens), reasoningTokens: nonnegative(outputDetails.reasoning_tokens) } }
  const content = body.output.flatMap((item: unknown) => item && typeof item === 'object' && 'content' in item
    && Array.isArray((item as { content: unknown }).content) ? (item as { content: unknown[] }).content : [])
  if (content.some((item: unknown) => item && typeof item === 'object' && 'type' in item && item.type === 'refusal')) {
    return { kind: 'refusal', text: null, ...metadata }
  }
  const texts = content.filter((item: unknown) => item && typeof item === 'object' && 'type' in item
    && item.type === 'output_text' && 'text' in item && typeof item.text === 'string') as { text: string }[]
  const raw = texts.map((item) => item.text).join('')
  if (!raw || raw.length > 16384) throw new AiProviderError('malformed')
  return { kind: 'text', text: raw, ...metadata }
}

export async function callOpenAI(body: unknown, apiKey: string, fetcher: typeof fetch = fetch): Promise<unknown> {
  let result: Response
  try {
    result = await fetcher('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(45_000),
    })
  } catch (error) {
    throw new AiProviderError(error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'provider_unavailable')
  }
  if (!result.ok) throw new AiProviderError(result.status === 429 ? 'rate_limited' : 'provider_unavailable')
  try {
    const text = await result.text()
    if (text.length > 131_072) throw new Error('oversized')
    return JSON.parse(text) as unknown
  } catch { throw new AiProviderError('malformed') }
}
