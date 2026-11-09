import { beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import v1Fixture from './fixtures/backup-v1.json?raw'
import { sampleRecord } from '../../test/fixtures'
import { db, type ExerciseRecord } from '../db/db'
import { saveCurrentExercise } from '../exercise/currentExercise'
import {
  BackupError,
  MAX_IMPORT_BYTES,
  exportBackup,
  parseBackup,
  readBackupFile,
} from './backup'
import type { ExerciseV1 } from './format'

beforeEach(async () => {
  vi.restoreAllMocks()
  localStorage.clear()
  await db.exercises.clear()
})

function backupText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...JSON.parse(v1Fixture), ...overrides })
}

function parseError(text: string): string {
  try {
    parseBackup(text)
  } catch (error) {
    if (error instanceof BackupError) return error.message
    throw error
  }
  throw new Error('expected parseBackup to fail')
}

describe('backup format', () => {
  // When these diverge, bump the format version and write a mapping
  // (DECISIONS.md M7). Checked by `tsc -b` in `npm run build`.
  it('keeps the current version in lockstep with ExerciseRecord', () => {
    expectTypeOf<ExerciseV1>().toEqualTypeOf<ExerciseRecord>()
  })

  it('still imports the committed v1 file', () => {
    const backup = parseBackup(v1Fixture)

    expect(backup.exercises).toHaveLength(2)
    expect(backup.exercises[1].solvedAt).toEqual(
      new Date('2026-11-03T18:05:00.000Z'),
    )
  })
})

describe('exportBackup', () => {
  it('round-trips the history sorted by solvedAt, with a dated name', async () => {
    const newer = sampleRecord({ solvedAt: new Date('2026-03-01') })
    const older = sampleRecord({ solvedAt: new Date('2026-01-01') })
    await db.exercises.bulkAdd([newer, older])

    const { fileName, json } = await exportBackup(new Date(2026, 10, 8))

    expect(fileName).toBe('language-tutor-en-es-2026-11-08.json')
    expect(parseBackup(json).exercises).toEqual([older, newer])
  })

  it('includes the on-screen exercise only once it is solved', async () => {
    const pending = {
      id: crypto.randomUUID(),
      sentence: 'Pending.',
      levelId: 'A1',
      grammarPoints: [],
      aiProvider: 'anthropic',
      aiModel: 'm',
    }
    saveCurrentExercise(pending)
    expect(parseBackup((await exportBackup()).json).exercises).toEqual([])

    saveCurrentExercise({
      ...pending,
      userTranslation: 'Pendiente.',
      evaluation: {
        ...sampleRecord().evaluation,
        solvedAt: '2026-05-01T00:00:00.000Z',
      },
    })
    const [exported] = parseBackup((await exportBackup()).json).exercises
    expect(exported).toMatchObject({ id: pending.id, sentence: 'Pending.' })
  })

  it('names a stored row that no longer fits the format', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await db.exercises.add(
      sampleRecord({ sentence: 'Stale row.', aiModel: '' }),
    )

    await expect(exportBackup()).rejects.toThrow(
      `Couldn't export. Exercise #1 ("Stale row."): aiModel:`,
    )
  })
})

describe('parseBackup', () => {
  it.each([
    ['not JSON', '{oops', /isn't valid JSON/],
    ['a foreign file', '{"hello":"world"}', /isn't a Language Tutor backup/],
    ['a newer version', backupText({ version: 2 }), /newer version/],
    [
      'another language pair',
      backupText({ languagePair: { source: 'en', target: 'fr' } }),
      /for en → fr, but this app is en → es/,
    ],
  ])('rejects %s', (_, text, message) => {
    expect(parseError(text)).toMatch(message)
  })

  it("reports a wrong pair even when the exercises don't parse", () => {
    expect(
      parseError(
        backupText({
          languagePair: { source: 'en', target: 'fr' },
          exercises: [{ unexpected: true }],
        }),
      ),
    ).toMatch(/for en → fr, but this app is en → es/)
  })

  it('rejects an id that appears twice', () => {
    const [first] = JSON.parse(v1Fixture).exercises
    expect(parseError(backupText({ exercises: [first, first] }))).toMatch(
      /same exercise twice \("The cat is sleeping/,
    )
  })

  it('names the exercise and field that failed, and counts the rest', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const exercises = JSON.parse(v1Fixture).exercises
    delete exercises[1].evaluation.scores.grammar
    exercises[1].solvedAt = null

    expect(parseError(backupText({ exercises }))).toBe(
      'Exercise #2 ("She had already left when I arrived."): missing evaluation.scores.grammar …and 1 more.',
    )
  })
})

// Backs the 100 MB limit with a measurement instead of an estimate
// (DECISIONS.md M7): a deliberately heavy record — more grammar points,
// issues and alternatives than a typical evaluation — must still leave room
// for ~50k exercises, and a 10k-exercise file must parse.
describe('backup size at scale', () => {
  const sentence =
    'Although she had been warned several times, she still decided to travel alone through the mountains last winter.'
  const issue =
    '"Había sido advertida" is correct, but "aunque le habían advertido" sounds more natural here; the passive is rare in everyday Spanish.'
  const alternative =
    'Aunque le habían advertido varias veces, aun así decidió viajar sola por las montañas el invierno pasado.'

  function heavyExercise() {
    return {
      ...JSON.parse(v1Fixture).exercises[1],
      id: crypto.randomUUID(),
      sentence,
      grammarPoints: [
        'past perfect passive',
        'concessive clauses',
        'adverbs of frequency',
      ],
      userTranslation: alternative,
      evaluation: {
        ...JSON.parse(v1Fixture).exercises[1].evaluation,
        issues: [issue, issue, issue, issue],
        alternatives: [alternative, alternative, alternative],
      },
    }
  }

  it('fits ~50k heavy exercises under the import limit, and parses 10k', () => {
    const count = 10_000
    const json = backupText({
      exercises: Array.from({ length: count }, heavyExercise),
    })
    // Indented like `exportBackup`, which is what lands on disk.
    const text = JSON.stringify(JSON.parse(json), null, 2)
    const bytesPerExercise = new Blob([text]).size / count

    expect(bytesPerExercise * 50_000).toBeLessThan(MAX_IMPORT_BYTES)
    expect(parseBackup(text).exercises).toHaveLength(count)
  }, 30_000)
})

describe('readBackupFile', () => {
  it('counts which exercises are new', async () => {
    const [first] = parseBackup(v1Fixture).exercises
    await db.exercises.add(first)

    const preview = await readBackupFile(new File([v1Fixture], 'b.json'))

    expect(preview.newCount).toBe(1)
  })

  it('refuses files over the size limit without reading them', async () => {
    const file = new File([], 'video.json')
    Object.defineProperty(file, 'size', { value: MAX_IMPORT_BYTES + 1 })

    await expect(readBackupFile(file)).rejects.toThrow(/too large/)
  })
})
