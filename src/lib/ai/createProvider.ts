import { AnthropicProvider } from './providers/anthropic'
import { GoogleProvider } from './providers/google'
import { OpenAICompatibleProvider } from './providers/openaiCompatible'
import type { AIProvider, ProviderConfig } from './types'

/** Build the adapter for a stored provider config. */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.providerId) {
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'google':
      return new GoogleProvider(config)
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config)
  }
}
