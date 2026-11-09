import { z } from 'zod'
import { appConfig } from '../../config'
import { db } from '../db/db'
import { loadSolvedCurrentExercise } from '../exercise/currentExercise'
import {
  BACKUP_FORMAT,
  BackupHeaderSchema,
  BackupV1Schema,
  CURRENT_VERSION,
  type BackupV1,
} from './format'

/** Guards against reading a wrongly picked file into memory; not a cap on
 *  data (~50k exercises) — see DECISIONS.md M7. */
export const MAX_IMPORT_BYTES = 100 * 1024 * 1024

const languagePair = {
  source: appConfig.sourceLanguage.code,
  target: appConfig.targetLanguage.code,
}

/** A problem with a backup file, worded for the user. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupError'
  }
}

function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * The full history as a backup file, plus the on-screen exercise if it's
 * solved — by M4's flush rule it isn't in Dexie yet. Rows are sorted by
 * `solvedAt` and indented, so backups are deterministic and diffable.
 */
export async function exportBackup(
  now = new Date(),
): Promise<{ fileName: string; json: string }> {
  const byId = new Map((await db.exercises.toArray()).map((r) => [r.id, r]))
  const solved = loadSolvedCurrentExercise()
  if (solved) byId.set(solved.id, solved)

  const backup: BackupV1 = {
    format: BACKUP_FORMAT,
    version: CURRENT_VERSION,
    exportedAt: now,
    languagePair,
    levelSystemId: appConfig.levelSystem.id,
    exercises: [...byId.values()].sort(
      (a, b) => a.solvedAt.getTime() - b.solvedAt.getTime(),
    ),
  }
  // Dexie rows aren't validated on write, so a row left over from an earlier
  // schema can fail here — name it instead of a generic error.
  const result = BackupV1Schema.safeEncode(backup, { reportInput: true })
  if (!result.success) {
    console.error(result.error)
    throw new BackupError(
      `Couldn't export. ${describeIssues(result.error, backup)}`,
    )
  }
  return {
    fileName: `language-tutor-${languagePair.source}-${languagePair.target}-${localDate(now)}.json`,
    json: JSON.stringify(result.data, null, 2),
  }
}

function truncate(text: string, max = 40): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

/** The first issue in user terms (which exercise, which field), plus a count
 *  of the rest. */
function describeIssues(error: z.ZodError, data: unknown): string {
  const [issue] = error.issues
  let path = issue.path.map(String)
  let subject = 'The backup'

  const index = issue.path[1]
  if (path[0] === 'exercises' && typeof index === 'number') {
    const sentence = (data as { exercises: { sentence?: unknown }[] })
      .exercises[index]?.sentence
    subject = `Exercise #${index + 1}`
    if (typeof sentence === 'string') subject += ` ("${truncate(sentence)}")`
    path = path.slice(2)
  }

  const field = path.join('.')
  const problem =
    issue.code === 'invalid_type' && issue.input === undefined
      ? `missing ${field}`
      : `${field && `${field}: `}${issue.message}`
  const more = error.issues.length - 1
  return `${subject}: ${problem}${more > 0 ? ` …and ${more} more.` : ''}`
}

/** Validates a whole backup file; throws `BackupError` on the first reason
 *  it can't be imported. Nothing is written. */
export function parseBackup(text: string): BackupV1 {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError("This file isn't valid JSON.")
  }

  const header = BackupHeaderSchema.safeParse(data)
  if (!header.success) {
    throw new BackupError("This file isn't a Language Tutor backup.")
  }
  if (header.data.version > CURRENT_VERSION) {
    throw new BackupError(
      'This backup was exported by a newer version of the app. Update the app to import it.',
    )
  }
  // Before the deep parse: another instance's exercises may not match ours,
  // and the pair is the reason that matters (DECISIONS.md M7).
  const { source, target } = header.data.languagePair
  if (source !== languagePair.source || target !== languagePair.target) {
    throw new BackupError(
      `This backup is for ${source} → ${target}, but this app is ${languagePair.source} → ${languagePair.target}.`,
    )
  }

  // v1 is the only version so far. Once v2 exists, switch on
  // `header.data.version` here and migrate older files forward step by step.
  const result = BackupV1Schema.safeParse(data, { reportInput: true })
  if (!result.success) {
    console.error(result.error)
    throw new BackupError(describeIssues(result.error, data))
  }
  const backup = result.data

  const seen = new Set<string>()
  for (const exercise of backup.exercises) {
    if (seen.has(exercise.id)) {
      throw new BackupError(
        `The file contains the same exercise twice ("${truncate(exercise.sentence)}").`,
      )
    }
    seen.add(exercise.id)
  }

  return backup
}

export interface ImportPreview {
  backup: BackupV1
  /** How many of the file's exercises aren't stored locally yet. */
  newCount: number
}

/** Step one of importing: validate the file and summarize it. Step two, on
 *  confirmation, is `addMissingExercises(preview.backup.exercises)`. */
export async function readBackupFile(file: File): Promise<ImportPreview> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new BackupError(
      `This file is too large. Backups are limited to ${MAX_IMPORT_BYTES / 1024 / 1024} MB.`,
    )
  }
  const backup = parseBackup(await file.text())
  const present = await db.exercises
    .where('id')
    .anyOf(backup.exercises.map((e) => e.id))
    .count()
  return { backup, newCount: backup.exercises.length - present }
}
