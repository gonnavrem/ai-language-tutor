import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin'
import { ProviderConfigSchema, type ProviderConfig } from '../ai/types'
import type { SecureStorage } from './types'

const STORAGE_KEY = 'ai-language-tutor:provider-config'

/**
 * Native storage backed by iOS Keychain / Android Keystore. The OS handles
 * encryption at rest, so unlike the web adapter there is nothing to encrypt
 * here — we only serialise and validate.
 */
export class CapacitorSecureStorage implements SecureStorage {
  async getProviderConfig(): Promise<ProviderConfig | null> {
    let stored: string
    try {
      const result = await SecureStoragePlugin.get({ key: STORAGE_KEY })
      stored = result.value
    } catch {
      // The plugin rejects with a plain string for a missing key and gives us
      // no way to tell that apart from a real Keychain failure. Treating any
      // read failure as "not configured" costs the user a re-entry of their
      // key, which beats crashing on launch.
      return null
    }

    return ProviderConfigSchema.parse(JSON.parse(stored))
  }

  async setProviderConfig(config: ProviderConfig): Promise<void> {
    await SecureStoragePlugin.set({
      key: STORAGE_KEY,
      value: JSON.stringify(config),
    })
  }

  async clearProviderConfig(): Promise<void> {
    try {
      await SecureStoragePlugin.remove({ key: STORAGE_KEY })
    } catch {
      // Removing a key that was never stored is a no-op, not a failure.
    }
  }
}
