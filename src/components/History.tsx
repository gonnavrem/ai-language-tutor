import { useState } from 'react'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { appConfig } from '../config'
import {
  deleteExercise,
  deleteExercises,
  useExercises,
  type ExerciseRecord,
} from '../lib/db'
import { computeOverallScore } from '../lib/exercise'
import { EvaluationView } from './EvaluationView'

const levels = appConfig.levelSystem.levels
const configLevelIds = new Set(levels.map((level) => level.id))
const ALL_LEVELS = ''
const DELETE_FAILED = "Couldn't delete — see console."

/** Stored ids aren't coerced to a config level: an id the config no longer
 *  has is shown raw, flagged (see DECISIONS.md M6). */
function LevelTag({ levelId }: { levelId: string }) {
  return (
    <span className="text-xs text-gray-500">
      {levelId}
      {!configLevelIds.has(levelId) && ' (no longer in config)'}
    </span>
  )
}

function HistoryRow({
  record,
  expanded,
  onToggle,
}: {
  record: ExerciseRecord
  expanded: boolean
  onToggle: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const Chevron = expanded ? ChevronDown : ChevronRight

  function handleToggle() {
    setConfirmingDelete(false)
    setDeleteError(null)
    onToggle()
  }

  async function handleDelete() {
    setDeleteError(null)
    try {
      await deleteExercise(record.id)
    } catch (error) {
      console.error(error)
      setDeleteError(DELETE_FAILED)
    }
  }

  return (
    <li className="rounded border border-gray-300">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-2 p-3 text-left"
      >
        <Chevron size={16} className="mt-1 shrink-0 text-gray-400" />
        <span className="flex flex-1 flex-col gap-1">
          <span>{record.sentence}</span>
          <span className="flex gap-3 text-xs text-gray-500">
            <LevelTag levelId={record.levelId} />
            {/* The expanded detail already shows the overall score. */}
            {!expanded && (
              <span>{computeOverallScore(record.evaluation.scores)} / 5</span>
            )}
            <span>{record.solvedAt.toLocaleDateString()}</span>
          </span>
        </span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-gray-200 p-3">
          <EvaluationView
            evaluation={record.evaluation}
            userTranslation={record.userTranslation}
          />
          <div>
            <p className="text-sm font-medium">Grammar points</p>
            <ul className="list-disc pl-5 text-sm text-gray-700">
              {record.grammarPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-gray-400">
            Sentence: {record.aiProvider} · {record.aiModel}
            <br />
            Evaluation: {record.evaluation.aiProvider} ·{' '}
            {record.evaluation.aiModel}
          </p>
          {confirmingDelete ? (
            <div className="flex items-center gap-3 text-sm">
              <span>Delete this exercise?</span>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="font-medium text-red-600"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false)
                  setDeleteError(null)
                }}
                className="text-gray-500"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1 self-start text-sm text-red-600"
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
          {deleteError && (
            <p role="alert" className="text-sm text-red-600">
              {deleteError}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

export function History() {
  const records = useExercises()
  const [levelFilter, setLevelFilter] = useState(ALL_LEVELS)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmingDeleteAll, setConfirmingDeleteAll] = useState(false)
  const [deleteAllError, setDeleteAllError] = useState<string | null>(null)

  const orphanLevelIds = [
    ...new Set(records?.map((record) => record.levelId)),
  ].filter((id) => !configLevelIds.has(id))
  // Falls back to "all" if the filtered orphan level just lost its last row.
  const activeFilter =
    configLevelIds.has(levelFilter) || orphanLevelIds.includes(levelFilter)
      ? levelFilter
      : ALL_LEVELS
  const filtering = activeFilter !== ALL_LEVELS
  const visible = filtering
    ? records?.filter((record) => record.levelId === activeFilter)
    : records

  function cancelDeleteAll() {
    setConfirmingDeleteAll(false)
    setDeleteAllError(null)
  }

  // Scoped to the active filter: "delete all" only removes what's listed.
  async function handleDeleteAll() {
    setDeleteAllError(null)
    try {
      await deleteExercises(filtering ? activeFilter : undefined)
      setConfirmingDeleteAll(false)
    } catch (error) {
      console.error(error)
      setDeleteAllError(DELETE_FAILED)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-medium">History</h1>
        <p className="text-sm text-gray-500">
          The exercise on the Practice screen appears here once you move on to
          the next one.
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Level</span>
        <select
          value={activeFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value)
            cancelDeleteAll()
          }}
          className="rounded border border-gray-300 px-3 py-2"
        >
          <option value={ALL_LEVELS}>All levels</option>
          {levels.map((level) => (
            <option key={level.id} value={level.id}>
              {level.label}
            </option>
          ))}
          {orphanLevelIds.map((id) => (
            <option key={id} value={id}>
              {id} (no longer in config)
            </option>
          ))}
        </select>
      </label>

      {records?.length === 0 && (
        <p className="text-sm text-gray-400">No exercises yet.</p>
      )}
      {records && records.length > 0 && visible?.length === 0 && (
        <p className="text-sm text-gray-400">No exercises at this level.</p>
      )}

      <ul className="flex flex-col gap-2">
        {visible?.map((record) => (
          <HistoryRow
            key={record.id}
            record={record}
            expanded={expandedId === record.id}
            onToggle={() =>
              setExpandedId(expandedId === record.id ? null : record.id)
            }
          />
        ))}
      </ul>

      {visible && visible.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {confirmingDeleteAll ? (
            <>
              <span>
                Delete all {visible.length}
                {filtering && ` ${activeFilter}`} exercises?
              </span>
              <button
                type="button"
                onClick={() => void handleDeleteAll()}
                className="font-medium text-red-600"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={cancelDeleteAll}
                className="text-gray-500"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDeleteAll(true)}
              className="text-red-600"
            >
              {filtering ? 'Delete all at this level' : 'Delete all'}
            </button>
          )}
          {deleteAllError && (
            <p role="alert" className="w-full text-red-600">
              {deleteAllError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
