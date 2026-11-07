import { useEffect, useRef, useState } from 'react'
import { Loader2, RefreshCw, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { appConfig, type Level } from '../config'
import {
  AIProviderError,
  AIRequestError,
  StructuredOutputError,
} from '../lib/ai'
import {
  NoProviderConfiguredError,
  computeOverallScore,
  loadCurrentExercise,
  requestExercise,
  saveCurrentExercise,
  submitEvaluation,
  type CurrentExercise,
  type EvaluationScores,
} from '../lib/exercise'

const levels = appConfig.levelSystem.levels

function levelById(id: string): Level {
  return levels.find((level) => level.id === id) ?? levels[0]
}

type PracticeError =
  { kind: 'no-provider' } | { kind: 'other'; message: string }

function describeError(err: unknown): PracticeError {
  if (err instanceof NoProviderConfiguredError) {
    return { kind: 'no-provider' }
  }
  if (err instanceof AIRequestError) {
    return {
      kind: 'other',
      message: `Provider returned HTTP ${err.status}: ${err.responseBody.slice(0, 200)}`,
    }
  }
  if (err instanceof StructuredOutputError) {
    return {
      kind: 'other',
      message: 'The model responded, but not in the expected format.',
    }
  }
  if (err instanceof AIProviderError) {
    return { kind: 'other', message: err.message }
  }
  console.error(err)
  return { kind: 'other', message: 'Unexpected error — see console.' }
}

const CATEGORY_LABELS: Record<keyof EvaluationScores, string> = {
  meaning: 'Meaning',
  grammar: 'Grammar',
  naturalness: 'Naturalness',
  vocabulary: 'Vocabulary',
}

function CategoryScore({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="flex gap-0.5" aria-label={`${label}: ${score} out of 5`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={14}
            className={
              i < score
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }
          />
        ))}
      </span>
    </div>
  )
}

export function Practice() {
  const [exercise, setExercise] = useState<CurrentExercise | null>(() =>
    loadCurrentExercise(),
  )
  const [levelId, setLevelId] = useState(
    () => exercise?.levelId ?? levels[0].id,
  )
  const [translation, setTranslation] = useState(
    () => exercise?.userTranslation ?? '',
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<PracticeError | null>(null)
  const hasRequestedInitial = useRef(false)
  const isMounted = useRef(true)
  const draftSaveTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  )

  async function runRequestExercise(level: Level) {
    setIsLoading(true)
    setError(null)
    try {
      const next = await requestExercise(level)
      if (!isMounted.current) return
      setExercise(next)
      setLevelId(level.id)
      setTranslation(next.userTranslation ?? '')
    } catch (err) {
      if (!isMounted.current) return
      setError(describeError(err))
    } finally {
      if (isMounted.current) setIsLoading(false)
    }
  }

  async function handleSubmitTranslation() {
    if (!exercise) return
    setIsLoading(true)
    setError(null)
    try {
      const next = await submitEvaluation(translation)
      if (!isMounted.current) return
      setExercise(next)
    } catch (err) {
      if (!isMounted.current) return
      setError(describeError(err))
    } finally {
      if (isMounted.current) setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      isMounted.current = false
      if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current)
    }
  }, [])

  useEffect(() => {
    if (exercise || hasRequestedInitial.current) return
    hasRequestedInitial.current = true
    void runRequestExercise(levelById(levelId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleLevelChange(nextId: string) {
    void runRequestExercise(levelById(nextId))
  }

  function handleRegenerate() {
    void runRequestExercise(levelById(levelId))
  }

  function handleTranslationChange(value: string) {
    setTranslation(value)
    if (!exercise || exercise.evaluation) return
    if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current)
    draftSaveTimeout.current = setTimeout(() => {
      saveCurrentExercise({ ...exercise, userTranslation: value })
    }, 300)
  }

  const evaluation = exercise?.evaluation

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-medium">Practice</h1>
        <p className="text-sm text-gray-500">
          Translate the sentence below into {appConfig.targetLanguage.name}.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Level</span>
        <select
          value={levelId}
          onChange={(e) => handleLevelChange(e.target.value)}
          disabled={isLoading}
          className="rounded border border-gray-300 px-3 py-2"
        >
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
        </select>
      </label>

      <div className="min-h-24 rounded border border-gray-300 p-4">
        {exercise ? (
          <p className="text-lg">{exercise.sentence}</p>
        ) : (
          !error && <p className="text-gray-400">Loading a sentence…</p>
        )}
      </div>

      {exercise && !evaluation && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Your translation</span>
          <textarea
            value={translation}
            onChange={(e) => handleTranslationChange(e.target.value)}
            disabled={isLoading}
            rows={3}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
      )}

      {exercise && !evaluation && (
        <button
          type="button"
          onClick={() => void handleSubmitTranslation()}
          disabled={isLoading || translation.trim().length === 0}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {isLoading ? 'Evaluating…' : 'Submit translation'}
        </button>
      )}

      {evaluation && (
        <div className="flex flex-col gap-3 rounded border border-gray-300 p-4">
          {exercise?.userTranslation && (
            <p className="text-sm text-gray-500">
              Your translation: {exercise.userTranslation}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="font-medium">Overall</span>
            <span className="font-medium">
              {computeOverallScore(evaluation.scores)} / 5
            </span>
          </div>
          {(Object.keys(CATEGORY_LABELS) as (keyof EvaluationScores)[]).map(
            (key) => (
              <CategoryScore
                key={key}
                label={CATEGORY_LABELS[key]}
                score={evaluation.scores[key]}
              />
            ),
          )}
          {evaluation.issues.length > 0 && (
            <div>
              <p className="text-sm font-medium">Issues</p>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {evaluation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
          {evaluation.alternatives.length > 0 && (
            <div>
              <p className="text-sm font-medium">Alternatives</p>
              <ul className="list-disc pl-5 text-sm text-gray-700">
                {evaluation.alternatives.map((alt, i) => (
                  <li key={i}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleRegenerate}
        disabled={isLoading}
        className="flex items-center justify-center gap-2 rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <RefreshCw size={16} />
        )}
        New sentence
      </button>

      {error?.kind === 'no-provider' && (
        <p role="alert" className="text-sm text-red-600">
          No AI provider configured yet.{' '}
          <Link to="/settings" className="underline">
            Add one in Settings
          </Link>
          .
        </p>
      )}
      {error?.kind === 'other' && (
        <p role="alert" className="text-sm text-red-600">
          {error.message}
        </p>
      )}
    </div>
  )
}
