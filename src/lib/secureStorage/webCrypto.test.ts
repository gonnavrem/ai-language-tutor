import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/db'
import { WebCryptoSecureStorage } from './webCrypto'
import type { ProviderConfig } from '../ai/types'

const sampleConfig: ProviderConfig = {
  providerId: 'anthropic',
  apiKey: 'sk-ant-super-secret-key',
  model: 'claude-sonnet-5',
}

beforeEach(async () => {
  localStorage.clear()
  await db.secureConfig.clear()
})

describe('WebCryptoSecureStorage', () => {
  it('returns null when nothing has been stored yet', async () => {
    const storage = new WebCryptoSecureStorage()
    expect(await storage.getProviderConfig()).toBeNull()
  })

  it('round-trips a stored config', async () => {
    const storage = new WebCryptoSecureStorage()
    await storage.setProviderConfig(sampleConfig)
    expect(await storage.getProviderConfig()).toEqual(sampleConfig)
  })

  it('does not store the API key in plaintext', async () => {
    const storage = new WebCryptoSecureStorage()
    await storage.setProviderConfig(sampleConfig)

    const record = await db.secureConfig.get(1)
    expect(record).toBeDefined()
    expect(record?.ciphertext).not.toContain(sampleConfig.apiKey)
  })

  it('removes the stored config on clear', async () => {
    const storage = new WebCryptoSecureStorage()
    await storage.setProviderConfig(sampleConfig)
    await storage.clearProviderConfig()
    expect(await storage.getProviderConfig()).toBeNull()
  })

  it('rejects if the stored ciphertext has been tampered with', async () => {
    const storage = new WebCryptoSecureStorage()
    await storage.setProviderConfig(sampleConfig)

    const record = await db.secureConfig.get(1)
    if (!record) throw new Error('expected a stored record')
    await db.secureConfig.put({
      ...record,
      ciphertext: 'A'.repeat(record.ciphertext.length),
    })

    await expect(storage.getProviderConfig()).rejects.toThrow()
  })
})
