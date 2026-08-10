import { z } from 'zod'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Providers this template ships adapters for. 'openai-compatible' covers the
 * OpenAI, DeepSeek, and Custom presets — they differ only in base URL/model,
 * not in wire protocol.
 */
export const ProviderIdSchema = z.enum([
  'anthropic',
  'google',
  'openai-compatible',
])
export type ProviderId = z.infer<typeof ProviderIdSchema>

export const ProviderConfigSchema = z.object({
  providerId: ProviderIdSchema,
  apiKey: z.string().min(1),
  model: z.string().min(1),
  /** Only meaningful for 'openai-compatible'; ignored otherwise. */
  baseUrl: z.url().optional(),
})
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

export interface GenerateStructuredParams<T> {
  systemPrompt: string
  prompt: string
  schema: z.ZodType<T>
  /**
   * Short identifier for the shape being requested (e.g. 'exercise_sentence').
   * Used as the tool/function name for adapters with native structured-output
   * or tool-forcing support; otherwise purely descriptive.
   */
  schemaName: string
}

export class AIProviderError extends Error {
  cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.name = 'AIProviderError'
    this.cause = cause
  }
}

/** Thrown when the provider returns a non-retryable HTTP error. */
export class AIRequestError extends AIProviderError {
  status: number
  responseBody: string

  constructor(
    message: string,
    status: number,
    responseBody: string,
    cause?: unknown,
  ) {
    super(message, cause)
    this.name = 'AIRequestError'
    this.status = status
    this.responseBody = responseBody
  }
}

/** Thrown when a response still fails schema validation after the retry. */
export class StructuredOutputError extends AIProviderError {
  rawResponse: string

  constructor(message: string, rawResponse: string, cause?: unknown) {
    super(message, cause)
    this.name = 'StructuredOutputError'
    this.rawResponse = rawResponse
  }
}

export interface AIProvider {
  readonly id: ProviderId
  /**
   * Request a response that validates against `schema`. Implementations may
   * use the provider's native structured-output/tool-forcing feature where
   * available, but MUST still run the result through `schema.parse()` — JSON
   * Schema can't express Zod refinements, so native validation alone isn't
   * sufficient.
   */
  generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T>
}
