import { AIProviderError, AIRequestError } from './types'

export interface PostJsonOptions {
  url: string
  headers: Record<string, string>
  body: unknown
  timeoutMs?: number
  maxRetries?: number
  retryDelayMs?: number
}

const DEFAULT_TIMEOUT_MS = 60_000
const DEFAULT_MAX_RETRIES = 2
const DEFAULT_RETRY_DELAY_MS = 500

/** Transient failures worth retrying; everything else is a caller error. */
const RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(
  base: number,
  attempt: number,
  retryAfterHeader?: string | null,
): number {
  const retryAfterSeconds = Number(retryAfterHeader)
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000
  }
  return base * 2 ** attempt
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * POST JSON and parse the JSON response, retrying transient failures with
 * exponential backoff (honouring Retry-After when the provider sends it).
 * This is the piece the official SDKs would otherwise give us for free.
 */
export async function postJson<T>({
  url,
  headers,
  body,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}: PostJsonOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
        },
        timeoutMs,
      )
    } catch (err) {
      // Network failure or timeout abort — both are worth another attempt.
      if (attempt >= maxRetries) {
        throw new AIProviderError(
          `Request to ${url} failed: ${String(err)}`,
          err,
        )
      }
      await sleep(backoffMs(retryDelayMs, attempt))
      continue
    }

    if (response.ok) {
      return (await response.json()) as T
    }

    const responseBody = await response.text().catch(() => '')
    if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
      await sleep(
        backoffMs(retryDelayMs, attempt, response.headers.get('retry-after')),
      )
      continue
    }

    throw new AIRequestError(
      `Provider request failed with status ${response.status}`,
      response.status,
      responseBody,
    )
  }
}
