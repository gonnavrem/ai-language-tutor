import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { postJson } from './http'
import { AIProviderError, AIRequestError } from './types'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

const baseOptions = {
  url: 'https://example.test/v1/thing',
  headers: { authorization: 'Bearer k' },
  body: { hello: true },
  retryDelayMs: 0,
}

describe('postJson', () => {
  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: 1 }))

    await expect(postJson(baseOptions)).resolves.toEqual({ ok: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends a JSON POST with the given headers', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))

    await postJson(baseOptions)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(baseOptions.url)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer k',
    })
    expect(JSON.parse(init.body)).toEqual({ hello: true })
  })

  it('retries a 429 and succeeds on the next attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'slow down' }, 429))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(postJson(baseOptions)).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries a network failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    await expect(postJson(baseOptions)).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 401 and throws AIRequestError with the status', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'bad key' }, 401))

    await expect(postJson(baseOptions)).rejects.toMatchObject({
      name: 'AIRequestError',
      status: 401,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gives up after exhausting retries on a persistent 500', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, 500))

    await expect(postJson(baseOptions)).rejects.toBeInstanceOf(AIRequestError)
    expect(fetchMock).toHaveBeenCalledTimes(3) // initial + 2 retries
  })

  it('wraps a persistent network failure in AIProviderError', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))

    await expect(postJson(baseOptions)).rejects.toBeInstanceOf(AIProviderError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
