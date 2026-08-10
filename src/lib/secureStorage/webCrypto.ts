import { db } from '../db/db'
import { ProviderConfigSchema, type ProviderConfig } from '../ai/types'
import type { SecureStorage } from './types'

const DEVICE_SEED_STORAGE_KEY = 'ai-language-tutor:device-seed'
const HKDF_SALT = new TextEncoder().encode('ai-language-tutor:secure-storage')
const HKDF_INFO = new TextEncoder().encode('provider-config-aes-gcm-key')
const RECORD_ID = 1

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function getOrCreateDeviceSeed(): Uint8Array {
  const existing = localStorage.getItem(DEVICE_SEED_STORAGE_KEY)
  if (existing) {
    return fromBase64(existing)
  }

  const seed = crypto.getRandomValues(new Uint8Array(32))
  localStorage.setItem(DEVICE_SEED_STORAGE_KEY, toBase64(seed))
  return seed
}

async function deriveEncryptionKey(): Promise<CryptoKey> {
  const seed = getOrCreateDeviceSeed()
  const seedKey = await crypto.subtle.importKey(
    'raw',
    seed.buffer as ArrayBuffer,
    'HKDF',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: HKDF_SALT, info: HKDF_INFO },
    seedKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export class WebCryptoSecureStorage implements SecureStorage {
  async getProviderConfig(): Promise<ProviderConfig | null> {
    const record = await db.secureConfig.get(RECORD_ID)
    if (!record) {
      return null
    }

    const key = await deriveEncryptionKey()
    const iv = fromBase64(record.iv)
    const ciphertext = fromBase64(record.ciphertext)
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      ciphertext.buffer as ArrayBuffer,
    )
    const json: unknown = JSON.parse(new TextDecoder().decode(plaintext))
    return ProviderConfigSchema.parse(json)
  }

  async setProviderConfig(config: ProviderConfig): Promise<void> {
    const key = await deriveEncryptionKey()
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const plaintext = new TextEncoder().encode(JSON.stringify(config))
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
      key,
      plaintext,
    )

    await db.secureConfig.put({
      id: RECORD_ID,
      ciphertext: toBase64(new Uint8Array(ciphertext)),
      iv: toBase64(iv),
    })
  }

  async clearProviderConfig(): Promise<void> {
    await db.secureConfig.delete(RECORD_ID)
  }
}
