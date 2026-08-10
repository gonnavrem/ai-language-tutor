import { z } from 'zod'
import { generateStructuredViaPrompt } from '../generateStructured'
import { postJson } from '../http'
import {
  AIProviderError,
  AIRequestError,
  type AIProvider,
  type ChatMessage,
  type GenerateStructuredParams,
  type ProviderConfig,
  type ProviderId,
} from '../types'
import { withoutSchemaDialect } from './jsonSchema'

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: ProviderId = 'openai-compatible'
  private config: ProviderConfig
  /**
   * Starts enabled for the OpenAI/DeepSeek presets, but an arbitrary Custom
   * endpoint (Ollama, LM Studio, vLLM…) may not support json_schema mode at
   * all — the first 400 turns it off for the session.
   */
  private useNativeStructuredOutput = true

  constructor(config: ProviderConfig) {
    if (!config.baseUrl) {
      throw new AIProviderError(
        'An OpenAI-compatible provider requires a base URL.',
      )
    }
    this.config = config
  }

  async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T> {
    const jsonSchema = withoutSchemaDialect(z.toJSONSchema(params.schema))

    const callRaw = (systemPrompt: string, messages: ChatMessage[]) =>
      this.request(systemPrompt, messages, {
        schema: jsonSchema,
        name: params.schemaName,
      })

    return generateStructuredViaPrompt(callRaw, params)
  }

  private async request(
    systemPrompt: string,
    messages: ChatMessage[],
    schema: { schema: unknown; name: string },
  ): Promise<string> {
    if (this.useNativeStructuredOutput) {
      try {
        return await this.send(systemPrompt, messages, schema)
      } catch (err) {
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
    schema: { schema: unknown; name: string } | undefined,
  ): Promise<string> {
    const baseUrl = this.config.baseUrl?.replace(/\/$/, '')

    const response = await postJson<OpenAIResponse>({
      url: `${baseUrl}/chat/completions`,
      headers: { authorization: `Bearer ${this.config.apiKey}` },
      body: {
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
        ...(schema
          ? {
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: schema.name,
                  schema: schema.schema,
                  strict: true,
                },
              },
            }
          : {}),
      },
    })

    return response.choices?.[0]?.message?.content ?? ''
  }
}
