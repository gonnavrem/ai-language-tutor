import { z } from 'zod'

/**
 * The backup file format. Written out explicitly and frozen per version, not
 * derived from `ExerciseRecordSchema`: a file outlives the code that wrote it
 * (see DECISIONS.md M7). Never change a published version — add the next one
 * and migrate older ones forward in `parseBackup`.
 */
export const BACKUP_FORMAT = 'ai-language-tutor/history'
export const CURRENT_VERSION = 1

const LanguagePairSchema = z.object({ source: z.string(), target: z.string() })

/** Enough to tell a foreign file, a newer version or another template
 *  instance's language pair apart before the deep parse. Shared by every
 *  version, so these fields must stay in all future formats. */
export const BackupHeaderSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  languagePair: LanguagePairSchema,
})

/** Strict ISO in the file, a real `Date` in the app. Not `z.coerce.date()`,
 *  which turns garbage like `null` into a valid but false date. */
const isoDate = z.codec(z.iso.datetime(), z.date(), {
  decode: (iso) => new Date(iso),
  encode: (date) => date.toISOString(),
})

const score = z.number().int().min(1).max(5)

const ExerciseV1Schema = z.object({
  id: z.uuid(),
  sentence: z.string().min(1),
  levelId: z.string().min(1),
  grammarPoints: z.array(z.string()),
  aiProvider: z.string().min(1),
  aiModel: z.string().min(1),
  userTranslation: z.string(),
  evaluation: z.object({
    scores: z.object({
      meaning: score,
      grammar: score,
      naturalness: score,
      vocabulary: score,
    }),
    issues: z.array(z.string()),
    alternatives: z.array(z.string()),
    aiProvider: z.string().min(1),
    aiModel: z.string().min(1),
  }),
  solvedAt: isoDate,
})
export type ExerciseV1 = z.output<typeof ExerciseV1Schema>

export const BackupV1Schema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exportedAt: isoDate,
  languagePair: LanguagePairSchema,
  levelSystemId: z.string(),
  exercises: z.array(ExerciseV1Schema),
})
export type BackupV1 = z.output<typeof BackupV1Schema>
