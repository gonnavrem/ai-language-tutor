import type { ProviderConfig } from '../ai/types'

export interface SecureStorage {
  getProviderConfig(): Promise<ProviderConfig | null>
  setProviderConfig(config: ProviderConfig): Promise<void>
  clearProviderConfig(): Promise<void>
}
