import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { OpenAICompatibleProvider } from './openaiCompatible'
import { AIProviderError, type ProviderConfig } from '../types'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const config: ProviderConfig = {
  providerId: 'openai-compatible',
  apiKey: 'sk-test',
  model: 'gpt-4o-mini',
  baseUrl: 'https://api.openai.com/v1',
}

const schema = z.object({ greeting: z.string() })

const params = {
  systemPrompt: 'Be helpful.',
  prompt: 'Say hi.',
  schema,
  schemaName: 'greeting',
}

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
  })
}

describe('OpenAICompatibleProvider', () => {
  it('requires a base URL', () => {
    expect(
      () => new OpenAICompatibleProvider({ ...config, baseUrl: undefined }),
    ).toThrow(AIProviderError)
  })

  it('returns the validated object from the first choice', async () => {
    fetchMock.mockResolvedValueOnce(
      chatResponse(JSON.stringify({ greeting: 'hi' })),
    )

    const result = await new OpenAICompatibleProvider(
      config,
    ).generateStructured(params)

    expect(result).toEqual({ greeting: 'hi' })
  })

  it('posts to chat/completions with a bearer token', async () => {
    fetchMock.mockResolvedValueOnce(
      chatResponse(JSON.stringify({ greeting: 'hi' })),
    )

    await new OpenAICompatibleProvider(config).generateStructured(params)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/chat/completions')
    expect(init.headers).toMatchObject({ authorization: 'Bearer sk-test' })
  })

  it('trims a trailing slash from a custom base URL', async () => {
    fetchMock.mockResolvedValueOnce(
      chatResponse(JSON.stringify({ greeting: 'hi' })),
    )

    await new OpenAICompatibleProvider({
      ...config,
      baseUrl: 'http://localhost:1234/v1/',
    }).generateStructured(params)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:1234/v1/chat/completions',
    )
  })

  it('sends the system prompt as a system-role message and names the json_schema', async () => {
    fetchMock.mockResolvedValueOnce(
      chatResponse(JSON.stringify({ greeting: 'hi' })),
    )

    await new OpenAICompatibleProvider(config).generateStructured(params)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.messages[0]).toMatchObject({ role: 'system' })
    expect(body.messages[1]).toMatchObject({ role: 'user', content: 'Say hi.' })
    expect(body.response_format.json_schema).toMatchObject({
      name: 'greeting',
      strict: true,
    })
  })

  it('degrades to prompt-only for endpoints that reject json_schema mode', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('{"error":"unsupported"}', { status: 400 }),
      )
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ greeting: 'hi' })))

    const result = await new OpenAICompatibleProvider(
      config,
    ).generateStructured(params)

    expect(result).toEqual({ greeting: 'hi' })
    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(retryBody).not.toHaveProperty('response_format')
  })
})
