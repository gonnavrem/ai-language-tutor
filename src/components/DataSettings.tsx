import { useState, type ChangeEvent } from 'react'
import { Loader2 } from 'lucide-react'
import {
  BackupError,
  exportBackup,
  readBackupFile,
  saveTextFile,
  type ImportPreview,
} from '../lib/backup'
import { addMissingExercises, useExerciseCount } from '../lib/db'
import { loadSolvedCurrentExercise } from '../lib/exercise'

type ImportState =
  | { status: 'idle' }
  | { status: 'validating' }
  | { status: 'ready' | 'importing'; preview: ImportPreview }
  | { status: 'done'; added: number }
  | { status: 'error'; message: string }

function exercises(count: number): string {
  return `${count} ${count === 1 ? 'exercise' : 'exercises'}`
}

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof BackupError) return error.message
  console.error(error)
  return fallback
}

export function DataSettings() {
  const storedCount = useExerciseCount()
  const [exportError, setExportError] = useState<string | null>(null)
  const [importState, setImportState] = useState<ImportState>({
    status: 'idle',
  })

  // A solved exercise still on screen isn't in Dexie yet, but is exported.
  // Read once: it can't change while this route (not Practice) is shown.
  const [hasSolvedCurrent] = useState(() => !!loadSolvedCurrentExercise())
  const canExport = !!storedCount || hasSolvedCurrent
  const busy =
    importState.status === 'validating' || importState.status === 'importing'

  async function handleExport() {
    setExportError(null)
    try {
      const { fileName, json } = await exportBackup()
      saveTextFile(fileName, json)
    } catch (error) {
      setExportError(messageFor(error, "Couldn't export — see console."))
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // so picking the same file again still fires
    if (!file) return
    setImportState({ status: 'validating' })
    try {
      setImportState({ status: 'ready', preview: await readBackupFile(file) })
    } catch (error) {
      setImportState({
        status: 'error',
        message: messageFor(error, "Couldn't read the file — see console."),
      })
    }
  }

  async function handleImport(preview: ImportPreview) {
    setImportState({ status: 'importing', preview })
    try {
      const added = await addMissingExercises(preview.backup.exercises)
      setImportState({ status: 'done', added })
    } catch (error) {
      setImportState({
        status: 'error',
        message: messageFor(error, "Couldn't import — see console."),
      })
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div>
        <h2 className="text-xl font-medium">Data</h2>
        <p className="text-sm text-gray-500">
          Back up your history to a file, or merge one back in. API keys are
          never included.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={!canExport}
          className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
        >
          Export history
        </button>
        <label className="cursor-pointer rounded border border-gray-300 px-4 py-2 has-disabled:cursor-default has-disabled:opacity-50">
          Import history
          {/* `accept` is only a hint (some Android pickers ignore it); the
              file is validated after reading. */}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFile(e)}
            disabled={busy}
            className="sr-only"
          />
        </label>
      </div>

      {storedCount !== undefined && !canExport && (
        <p className="text-sm text-gray-400">Nothing to export yet.</p>
      )}
      {exportError && (
        <p role="alert" className="text-sm text-red-600">
          {exportError}
        </p>
      )}

      {importState.status === 'validating' && (
        <p className="flex items-center gap-1 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> Validating…
        </p>
      )}
      {(importState.status === 'ready' ||
        importState.status === 'importing') && (
        <ImportSummary
          preview={importState.preview}
          importing={importState.status === 'importing'}
          onImport={() => void handleImport(importState.preview)}
          onCancel={() => setImportState({ status: 'idle' })}
        />
      )}
      {importState.status === 'done' && (
        <p role="status" className="text-sm text-green-600">
          Imported {exercises(importState.added)}.
        </p>
      )}
      {importState.status === 'error' && (
        <p role="alert" className="text-sm text-red-600">
          {importState.message}
        </p>
      )}
    </section>
  )
}

function ImportSummary({
  preview: { backup, newCount },
  importing,
  onImport,
  onCancel,
}: {
  preview: ImportPreview
  importing: boolean
  onImport: () => void
  onCancel: () => void
}) {
  const total = backup.exercises.length
  return (
    <div className="flex flex-col gap-2 rounded border border-gray-300 p-3 text-sm">
      <p>
        {exercises(total)} · {backup.languagePair.source} →{' '}
        {backup.languagePair.target} · exported{' '}
        {backup.exportedAt.toLocaleDateString()}
      </p>
      <p className="text-gray-500">
        {newCount} new, {total - newCount} already present.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onImport}
          disabled={importing || newCount === 0}
          className="flex items-center gap-2 rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {importing && <Loader2 size={16} className="animate-spin" />}
          Import
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={importing}
          className="text-gray-500"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
