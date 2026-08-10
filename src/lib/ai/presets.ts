import type { ProviderId } from './types'

export interface ProviderPreset {
  /** UI-level identifier — distinct for OpenAI/DeepSeek/Custom even though
   *  they share providerId: 'openai-compatible'. */
  id: string
  label: string
  providerId: ProviderId
  /** Fixed endpoint for hosted presets; undefined for Custom, where the user supplies one. */
  baseUrl?: string
  baseUrlEditable: boolean
  /** Datalist suggestions, cheapest first — never validated, just autocomplete. */
  suggestedModels: string[]
  defaultModel: string
}

export const providerPresets: ProviderPreset[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    providerId: 'anthropic',
    baseUrlEditable: false,
    suggestedModels: ['claude-haiku-4-5', 'claude-sonnet-5'],
    defaultModel: 'claude-haiku-4-5',
  },
  {
    id: 'google',
    label: 'Google',
    providerId: 'google',
    baseUrlEditable: false,
    suggestedModels: ['gemini-2.5-flash', 'gemini-3.5-flash'],
    defaultModel: 'gemini-2.5-flash',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    providerId: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    baseUrlEditable: false,
    suggestedModels: ['gpt-5.6-luna', 'gpt-5.6-terra'],
    defaultModel: 'gpt-5.6-luna',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    providerId: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    baseUrlEditable: false,
    suggestedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    defaultModel: 'deepseek-v4-flash',
  },
  {
    id: 'custom',
    label: 'Custom',
    providerId: 'openai-compatible',
    baseUrlEditable: true,
    suggestedModels: [],
    defaultModel: '',
  },
]
