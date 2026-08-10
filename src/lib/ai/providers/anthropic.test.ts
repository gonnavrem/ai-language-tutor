import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AnthropicProvider } from './anthropic'
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
  providerId: 'anthropic',
  apiKey: 'sk-ant-test',
  model: 'claude-haiku-4-5',
}

const schema = z.object({ greeting: z.string() })

const params = {
  systemPrompt: 'Be helpful.',
  prompt: 'Say hi.',
  schema,
  schemaName: 'greeting',
}

function textResponse(text: string, status = 200): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status,
  })
}

describe('AnthropicProvider', () => {
  it('returns the validated object from the response text blocks', async () => {
    fetchMock.mockResolvedValueOnce(
      textResponse(JSON.stringify({ greeting: 'hi' })),
    )

    const result = await new AnthropicProvider(config).generateStructured(
      params,
    )

    expect(result).toEqual({ greeting: 'hi' })
  })

  it('sends the browser-access header required for direct CORS calls', async () => {
    fetchMock.mockResolvedValueOnce(
      textResponse(JSON.stringify({ greeting: 'hi' })),
    )

    await new AnthropicProvider(config).generateStructured(params)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers).toMatchObject({
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    })
  })

  it('requests native structured output and strips the $schema dialect key', async () => {
    fetchMock.mockResolvedValueOnce(
      textResponse(JSON.stringify({ greeting: 'hi' })),
    )

    await new AnthropicProvider(config).generateStructured(params)

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.model).toBe('claude-haiku-4-5')
    expect(body.output_config.format.type).toBe('json_schema')
    expect(body.output_config.format.schema).not.toHaveProperty('$schema')
    expect(body.output_config.format.schema.properties).toHaveProperty(
      'greeting',
    )
  })

  it('falls back to the prompt-only path when the API rejects output_config', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response('{"error":"bad field"}', { status: 400 }),
      )
      .mockResolvedValueOnce(textResponse(JSON.stringify({ greeting: 'hi' })))

    const result = await new AnthropicProvider(config).generateStructured(
      params,
    )

    expect(result).toEqual({ greeting: 'hi' })
    expect(fetchMock).toHaveBeenCalledTimes(2)

    const retryBody = JSON.parse(fetchMock.mock.calls[1][1].body)
    expect(retryBody).not.toHaveProperty('output_config')
  })

  it('propagates a non-400 error instead of silently degrading', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"bad key"}', { status: 401 }),
    )

    await expect(
      new AnthropicProvider(config).generateStructured(params),
    ).rejects.toMatchObject({ status: 401 })
  })
})
