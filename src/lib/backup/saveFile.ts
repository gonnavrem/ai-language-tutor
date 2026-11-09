import { Capacitor } from '@capacitor/core'
import { BackupError } from './backup'

/**
 * Hands a text file to the user. Web/PWA only for now: Android's WebView
 * ignores `<a download>`, so the native path (Filesystem + Share) is an
 * explicit M8 task — see DECISIONS.md M7.
 */
export function saveTextFile(fileName: string, content: string): void {
  if (Capacitor.isNativePlatform()) {
    throw new BackupError('Exporting is not available in the app yet.')
  }
  const url = URL.createObjectURL(
    new Blob([content], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // The download may start after `click()` returns (WebKit); revoking on the
  // next tick can cancel it. 40 s is FileSaver.js's long-proven delay.
  setTimeout(() => URL.revokeObjectURL(url), 40_000)
}
