import { db } from '../lib/db/db'
import { saveExercise } from '../lib/db/exercises'
import {
  ExerciseRecordSchema,
  type ExerciseRecord,
} from '../lib/exercise/types'
import { MOCK_EVALUATIONS, MOCK_SENTENCES } from './mockData'

const DAY_MS = 24 * 60 * 60 * 1000
/** Which canned evaluation each sample sentence gets — a spread of scores. */
const EVALUATION_PATTERN = [0, 1, 0, 2, 1, 3, 2, 0, 4, 1, 2, 3]
/** A level id no config has, to show the "no longer in config" marker. */
const ORPHAN_LEVEL_ID = 'X1'

function buildRecord(
  index: number,
  sentence: (typeof MOCK_SENTENCES)[number],
  evaluationIndex: number,
  now: number,
  levelId = sentence.levelId,
): ExerciseRecord {
  const evaluation = MOCK_EVALUATIONS[evaluationIndex]
  return ExerciseRecordSchema.parse({
    id: crypto.randomUUID(),
    sentence: sentence.sentence,
    levelId,
    grammarPoints: sentence.grammarPoints,
    aiProvider: 'anthropic',
    aiModel: 'mock',
    userTranslation:
      evaluation.scores.meaning >= 4 ? sentence.translation : sentence.flawed,
    evaluation: { ...evaluation, aiProvider: 'anthropic', aiModel: 'mock' },
    // Newest first: one every ~2.5 days going back from now.
    solvedAt: new Date(now - index * 2.5 * DAY_MS - 3 * 60 * 60 * 1000),
  })
}

/** Deterministic sample history: every level, the full range of scores, and
 *  one row whose level is not in the config. */
export function buildSeedRecords(now = Date.now()): ExerciseRecord[] {
  const records = MOCK_SENTENCES.map((sentence, i) =>
    buildRecord(
      i,
      sentence,
      EVALUATION_PATTERN[i % EVALUATION_PATTERN.length],
      now,
    ),
  )
  records.push(
    buildRecord(records.length, MOCK_SENTENCES[0], 1, now, ORPHAN_LEVEL_ID),
  )
  return records
}

/** Only when the table is empty, so restarting the mock server resets an
 *  emptied history but never duplicates a populated one. */
export async function seedHistoryIfEmpty(): Promise<void> {
  if ((await db.exercises.count()) > 0) return
  for (const record of buildSeedRecords()) await saveExercise(record)
}
