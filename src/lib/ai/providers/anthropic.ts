import { z } from 'zod'
import { generateStructuredViaPrompt } from '../generateStructured'
import { postJson } from '../http'
import {
  AIRequestError,
  type AIProvider,
  type ChatMessage,
  type GenerateStructuredParams,
  type ProviderConfig,
  type ProviderId,
} from '../types'
import { withoutSchemaDialect } from './jsonSchema'

const API_URL = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const MAX_TOKENS = 4096

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>
}

export class AnthropicProvider implements AIProvider {
  readonly id: ProviderId = 'anthropic'
  private config: ProviderConfig
  /** Flipped off if the API rejects the native structured-output field. */
  private useNativeStructuredOutput = true

  constructor(config: ProviderConfig) {
    this.config = config
  }

  async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T> {
    const jsonSchema = withoutSchemaDialect(z.toJSONSchema(params.schema))

    const callRaw = (systemPrompt: string, messages: ChatMessage[]) =>
      this.request(systemPrompt, messages, jsonSchema)

    return generateStructuredViaPrompt(callRaw, params)
  }

  private async request(
    systemPrompt: string,
    messages: ChatMessage[],
    jsonSchema: unknown,
  ): Promise<string> {
    if (this.useNativeStructuredOutput) {
      try {
        return await this.send(systemPrompt, messages, jsonSchema)
      } catch (err) {
        // A 400 most likely means this model/account doesn't accept
        // output_config. Fall back to the prompt-only path, which already
        // validates with Zod, rather than failing the user's request.
        if (!(err instanceof AIRequestError) || err.status !== 400) {
          throw err
        }
        this.useNativeStructuredOutput = false
      }
    }

    return this.send(systemPrompt, messages, undefined)
  }

  private async send(
    systemPrompt: string,
    messages: ChatMessage[],
    jsonSchema: unknown,
  ): Promise<string> {
    const response = await postJson<AnthropicResponse>({
      url: API_URL,
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': API_VERSION,
        // Undocumented but required: without it the CORS preflight fails and
        // the browser blocks the request entirely.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: {
        model: this.config.model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        ...(jsonSchema
          ? {
              output_config: {
                format: { type: 'json_schema', schema: jsonSchema },
              },
            }
          : {}),
      },
    })

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')
  }
}
