import { Capacitor } from '@capacitor/core'
import { CapacitorSecureStorage } from './capacitor'
import { WebCryptoSecureStorage } from './webCrypto'
import type { SecureStorage } from './types'

export type { SecureStorage } from './types'
export { CapacitorSecureStorage } from './capacitor'
export { WebCryptoSecureStorage } from './webCrypto'

/**
 * The storage the app should use: OS-backed Keychain/Keystore inside a native
 * Capacitor shell, Web Crypto AES-GCM everywhere else (browser, PWA).
 */
export const secureStorage: SecureStorage = Capacitor.isNativePlatform()
  ? new CapacitorSecureStorage()
  : new WebCryptoSecureStorage()
