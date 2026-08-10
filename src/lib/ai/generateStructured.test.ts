import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { generateStructuredViaPrompt } from './generateStructured'
import { StructuredOutputError } from './types'
import type { GenerateStructuredParams } from './types'

const schema = z.object({ greeting: z.string() })

const params: GenerateStructuredParams<z.infer<typeof schema>> = {
  systemPrompt: 'Be helpful.',
  prompt: 'Say hi.',
  schema,
  schemaName: 'greeting',
}

describe('generateStructuredViaPrompt', () => {
  it('resolves with parsed data when the first response is valid JSON', async () => {
    const callRaw = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ greeting: 'hi' }))

    const result = await generateStructuredViaPrompt(callRaw, params)

    expect(result).toEqual({ greeting: 'hi' })
    expect(callRaw).toHaveBeenCalledTimes(1)
  })

  it('embeds the schema without the $schema dialect key, matching the native copies', async () => {
    const callRaw = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ greeting: 'hi' }))

    await generateStructuredViaPrompt(callRaw, params)

    const systemPrompt = callRaw.mock.calls[0][0]
    expect(systemPrompt).toContain('"greeting"')
    expect(systemPrompt).not.toContain('$schema')
  })

  it('strips a markdown code fence before parsing', async () => {
    const callRaw = vi.fn().mockResolvedValue('```json\n{"greeting":"hi"}\n```')

    const result = await generateStructuredViaPrompt(callRaw, params)

    expect(result).toEqual({ greeting: 'hi' })
    expect(callRaw).toHaveBeenCalledTimes(1)
  })

  it('retries once, feeding back the parse error, and succeeds on the second attempt', async () => {
    const callRaw = vi
      .fn()
      .mockResolvedValueOnce('not json at all')
      .mockResolvedValueOnce(JSON.stringify({ greeting: 'hi' }))

    const result = await generateStructuredViaPrompt(callRaw, params)

    expect(result).toEqual({ greeting: 'hi' })
    expect(callRaw).toHaveBeenCalledTimes(2)

    const retryMessages = callRaw.mock.calls[1][1]
    expect(retryMessages.at(-1)).toMatchObject({
      role: 'user',
      content: expect.stringContaining('invalid'),
    })
  })

  it('retries when JSON is valid but fails schema validation', async () => {
    const callRaw = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ greeting: 42 }))
      .mockResolvedValueOnce(JSON.stringify({ greeting: 'hi' }))

    const result = await generateStructuredViaPrompt(callRaw, params)

    expect(result).toEqual({ greeting: 'hi' })
    expect(callRaw).toHaveBeenCalledTimes(2)
  })

  it('throws StructuredOutputError with the raw response once the retry also fails', async () => {
    const callRaw = vi
      .fn()
      .mockResolvedValueOnce('first bad')
      .mockResolvedValueOnce('second bad')

    await expect(
      generateStructuredViaPrompt(callRaw, params),
    ).rejects.toMatchObject({
      rawResponse: 'second bad',
    })
    expect(callRaw).toHaveBeenCalledTimes(2)
  })

  it('throws an instance of StructuredOutputError specifically', async () => {
    const callRaw = vi.fn().mockResolvedValue('still not json')

    await expect(generateStructuredViaPrompt(callRaw, params)).rejects.toThrow(
      StructuredOutputError,
    )
  })
})
