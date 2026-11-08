import { MOCK_MODE } from '../../dev/mockMode'
import { MockProvider } from '../../dev/mockProvider'
import { AnthropicProvider } from './providers/anthropic'
import { GoogleProvider } from './providers/google'
import { OpenAICompatibleProvider } from './providers/openaiCompatible'
import type { AIProvider, ProviderConfig } from './types'

/** Build the adapter for a stored provider config. */
export function createProvider(config: ProviderConfig): AIProvider {
  // Dev-only (`npm run dev:mock`): never reaches the network. A compile-time
  // constant, so production builds drop this branch and the mock with it.
  if (MOCK_MODE) return new MockProvider()

  switch (config.providerId) {
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'google':
      return new GoogleProvider(config)
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config)
  }
}
