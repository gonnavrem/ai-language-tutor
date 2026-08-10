import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { GoogleProvider } from './google'
import type { ProviderConfig } from '../types'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const config: ProviderConfig = {
  providerId: 'google',
  apiKey: 'goog-test-key',
  model: 'gemini-2.0-flash',
}

const schema = z.object({ greeting: z.string() })

const params = {
  systemPrompt: 'Be helpful.',
  prompt: 'Say hi.',
  schema,
  schemaName: 'greeting',
}

function candidateResponse(text: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200 },
  )
}

describe('GoogleProvider', () => {
  it('returns the validated object from the candidate parts', async () => {
    fetchMock.mockResolvedValueOnce(
      candidateResponse(JSON.stringify({ greeting: 'hi' })),
    )

    const result = await new GoogleProvider(config).generateStructured(params)

    expect(result).toEqual({ greeting: 'hi' })
  })

  it('calls generateContent with the api-key header', async () => {
    fetchMock.mockResolvedValueOnce(
      candidateResponse(JSON.stringify({ greeting: 'hi' })),
    )

    await new GoogleProvider(config).generateStructured(params)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    )
    expect(init.headers).toMatchObject({ 'x-goog-api-key': 'goog-test-key' })
  })

  it('sends the system prompt separately and a responseSchema without additionalProperties', async () => {
    fetchMock.mockResolvedValueOnce(
      candidateResponse(JSON.stringify({ greeting: 'hi' })),
    )

    await new GoogleProvider(config).generateStructured(params)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.systemInstruction.parts[0].text).toContain('Be helpful.')
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseSchema).not.toHaveProperty(
      'additionalProperties',
    )
    expect(body.generationConfig.responseSchema).not.toHaveProperty('$schema')
  })

  it("maps the assistant role to Google's 'model' role on retry turns", async () => {
    fetchMock
      .mockResolvedValueOnce(candidateResponse('not json at all'))
      .mockResolvedValueOnce(
        candidateResponse(JSON.stringify({ greeting: 'hi' })),
      )

    await new GoogleProvider(config).generateStructured(params)

    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(retryBody.contents.map((c: { role: string }) => c.role)).toEqual([
      'user',
      'model',
      'user',
    ])
  })

  it('falls back to prompt-only when responseSchema is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('{"error":"bad schema"}', { status: 400 }),
      )
      .mockResolvedValueOnce(
        candidateResponse(JSON.stringify({ greeting: 'hi' })),
      )

    const result = await new GoogleProvider(config).generateStructured(params)

    expect(result).toEqual({ greeting: 'hi' })
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(retryBody.generationConfig).not.toHaveProperty('responseSchema')
  })
})
