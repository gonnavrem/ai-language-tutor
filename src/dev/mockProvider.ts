import {
  AIProviderError,
  type AIProvider,
  type GenerateStructuredParams,
} from '../lib/ai/types'
import { MOCK_EVALUATIONS, MOCK_SENTENCES } from './mockData'

// Module-level on purpose: `createProvider` builds a fresh provider on every
// call, so per-instance counters would always restart at the first item.
const sentenceCursor = new Map<string, number>()
let evaluationCursor = 0

function nextSentence(prompt: string) {
  // Coupled to the wording in generateExercise.ts; mockProvider.test.ts runs
  // the real generator against this so drift fails loudly.
  const levelId = /for level (\w+)/.exec(prompt)?.[1] ?? ''
  const forLevel = MOCK_SENTENCES.filter((s) => s.levelId === levelId)
  const pool = forLevel.length > 0 ? forLevel : MOCK_SENTENCES

  const cursor = sentenceCursor.get(levelId) ?? 0
  sentenceCursor.set(levelId, cursor + 1)
  const { sentence, grammarPoints } = pool[cursor % pool.length]
  return { sentence, grammarPoints }
}

function nextEvaluation() {
  return MOCK_EVALUATIONS[evaluationCursor++ % MOCK_EVALUATIONS.length]
}

/**
 * Canned stand-in for a real adapter: never touches the network. Responses
 * still go through the caller's Zod schema, like a real adapter's must.
 */
export class MockProvider implements AIProvider {
  readonly id = 'anthropic'

  private readonly delayMs: number

  constructor(delayMs = 600) {
    this.delayMs = delayMs
  }

  async generateStructured<T>({
    prompt,
    schema,
    schemaName,
  }: GenerateStructuredParams<T>): Promise<T> {
    // Latency, so loading states and disabled controls can be seen.
    await new Promise((resolve) => setTimeout(resolve, this.delayMs))

    switch (schemaName) {
      case 'exercise_sentence':
        return schema.parse(nextSentence(prompt))
      case 'translation_evaluation':
        return schema.parse(nextEvaluation())
      case 'connection_test': // Settings' "Test connection" button
        return schema.parse({ ok: true })
      default:
        throw new AIProviderError(
          `MockProvider has no canned response for "${schemaName}".`,
        )
    }
  }
}
