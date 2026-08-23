import { beforeEach, describe, expect, it } from 'vitest'
import {
  discardCurrentExercise,
  loadCurrentExercise,
  saveCurrentExercise,
} from './currentExercise'
import type { CurrentExercise } from './types'

const sample: CurrentExercise = {
  sentence: 'The cat is sleeping.',
  levelId: 'A1',
  grammarPoints: ['present continuous'],
  aiProvider: 'anthropic',
  aiModel: 'claude-sonnet-5',
  createdAt: '2026-01-01T00:00:00.000Z',
}

beforeEach(() => {
  localStorage.clear()
})

describe('currentExercise', () => {
  it('returns null when nothing is stored', () => {
    expect(loadCurrentExercise()).toBeNull()
  })

  it('round-trips a saved exercise', () => {
    saveCurrentExercise(sample)
    expect(loadCurrentExercise()).toEqual(sample)
  })

  it('returns null after discarding', () => {
    saveCurrentExercise(sample)
    discardCurrentExercise()
    expect(loadCurrentExercise()).toBeNull()
  })

  it('treats invalid JSON as nothing pending', () => {
    localStorage.setItem('language-tutor:current-exercise', 'not json')
    expect(loadCurrentExercise()).toBeNull()
  })

  it('treats a shape that fails schema validation as nothing pending', () => {
    localStorage.setItem(
      'language-tutor:current-exercise',
      JSON.stringify({ sentence: 'missing other fields' }),
    )
    expect(loadCurrentExercise()).toBeNull()
  })
})
