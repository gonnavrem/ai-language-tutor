import { appConfig, type Level } from '../../config'
import type { AIProvider } from '../ai'
import { ExerciseSentenceSchema, type ExerciseSentence } from './types'

function buildPrompt(level: Level) {
  const { sourceLanguage, targetLanguage, levelSystem } = appConfig

  const systemPrompt = [
    `You are generating translation-practice sentences for a ${sourceLanguage.name}-to-${targetLanguage.name} language tutor app.`,
    `Write one sentence in ${sourceLanguage.name} for a learner to translate into ${targetLanguage.name}.`,
    `The sentence's grammar and vocabulary must match ${levelSystem.name} level ${level.id} (${level.label}): ${level.description}`,
    'Choose 1-3 specific grammar points this sentence is designed to exercise (e.g. "past continuous", "ser vs estar"). These are for internal tracking only — never hint at, name, or explain them within the sentence itself.',
  ].join('\n')

  return {
    systemPrompt,
    prompt: `Generate one exercise sentence for level ${level.id}.`,
  }
}

export function generateExerciseSentence(
  level: Level,
  provider: AIProvider,
): Promise<ExerciseSentence> {
  const { systemPrompt, prompt } = buildPrompt(level)
  return provider.generateStructured({
    systemPrompt,
    prompt,
    schema: ExerciseSentenceSchema,
    schemaName: 'exercise_sentence',
  })
}
