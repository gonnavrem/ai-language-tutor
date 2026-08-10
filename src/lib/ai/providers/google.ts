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
import { toGoogleSchema } from './jsonSchema'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

interface GoogleResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}

export class GoogleProvider implements AIProvider {
  readonly id: ProviderId = 'google'
  private config: ProviderConfig
  private useNativeStructuredOutput = true

  constructor(config: ProviderConfig) {
    this.config = config
  }

  async generateStructured<T>(params: GenerateStructuredParams<T>): Promise<T> {
    const responseSchema = toGoogleSchema(z.toJSONSchema(params.schema))

    const callRaw = (systemPrompt: string, messages: ChatMessage[]) =>
      this.request(systemPrompt, messages, responseSchema)

    return generateStructuredViaPrompt(callRaw, params)
  }

  private async request(
    systemPrompt: string,
    messages: ChatMessage[],
    responseSchema: unknown,
  ): Promise<string> {
    if (this.useNativeStructuredOutput) {
      try {
        return await this.send(systemPrompt, messages, responseSchema)
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
    responseSchema: unknown,
  ): Promise<string> {
    const response = await postJson<GoogleResponse>({
      url: `${API_BASE}/${this.config.model}:generateContent`,
      headers: { 'x-goog-api-key': this.config.apiKey },
      body: {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        // Google names the assistant turn 'model', not 'assistant'.
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          responseMimeType: 'application/json',
          ...(responseSchema ? { responseSchema } : {}),
        },
      },
    })

    return (response.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('')
  }
}
