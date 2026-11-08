import { Star } from 'lucide-react'
import {
  computeOverallScore,
  type EvaluationResult,
  type EvaluationScores,
} from '../lib/exercise'

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
              i < score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }
          />
        ))}
      </span>
    </div>
  )
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="list-disc pl-5 text-sm text-gray-700">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/** Shared by Practice and History — both hold the same evaluation shape. */
export function EvaluationView({
  evaluation,
  userTranslation,
}: {
  evaluation: EvaluationResult
  userTranslation?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {userTranslation && (
        <p className="text-sm text-gray-500">
          Your translation: {userTranslation}
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
      <BulletList title="Issues" items={evaluation.issues} />
      <BulletList title="Alternatives" items={evaluation.alternatives} />
    </div>
  )
}
