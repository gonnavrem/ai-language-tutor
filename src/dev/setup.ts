import { secureStorage } from '../lib/secureStorage'
import { seedHistoryIfEmpty } from './seed'

/**
 * Runs before the app renders in mock mode. Stores a placeholder provider
 * config so the real call sites (which read the config before creating a
 * provider) work unchanged; `createProvider` then ignores it and returns the
 * MockProvider. Safe to overwrite: mock mode runs on its own port, hence its
 * own origin and storage, never alongside real data (see DECISIONS.md).
 */
export async function setupMockMode(): Promise<void> {
  document.title = `[MOCK] ${document.title}`
  await secureStorage.setProviderConfig({
    providerId: 'anthropic',
    apiKey: 'mock',
    model: 'mock',
  })
  await seedHistoryIfEmpty()
}
