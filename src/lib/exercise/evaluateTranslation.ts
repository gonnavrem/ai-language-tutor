import { appConfig } from '../../config'
import type { AIProvider } from '../ai'
import { EvaluationResultSchema, type EvaluationResult } from './types'

/**
 * Compact form of the rubric in DECISIONS.md M5 — one clause per band rather
 * than full prose, to keep the per-call token cost down (the user pays for
 * this via their own key). Judges intent/fidelity over literal word matching,
 * per CLAUDE.md.
 */
const RUBRIC = [
  'Meaning: 5=intención y matices intactos; 4=matiz secundario perdido; 3=falta info relevante o intención alterada; 2=inversión de sentido, negación mal puesta o falso amigo grave; 1=irreconocible/contradictorio',
  'Grammar: 5=sin errores; 4=un error menor; 3=dos errores menores o uno estructural; 2=varios errores o estructura rota; 1=sintaxis colapsada',
  'Naturalness: 5=idiomático; 4=natural con algún giro rígido; 3=calco evidente del idioma origen; 2=muy forzado, combinaciones extrañas; 1=palabra por palabra, absurdo',
  'Vocabulary: 5=preciso y registro adecuado; 4=válido pero genérico; 3=término fuera de contexto o registro; 2=incorrecto o falso amigo repetido; 1=inventado o idioma equivocado',
].join('\n')

function buildPrompt(sentence: string, translation: string) {
  const { sourceLanguage, targetLanguage } = appConfig

  const systemPrompt = [
    `You are evaluating a learner's ${sourceLanguage.name}-to-${targetLanguage.name} translation for a language tutor app.`,
    `Judge overall meaning and intent the way a teacher would, not literal word-for-word matching — some flexibility in vocabulary and grammatical structure is expected and correct.`,
    'Score each category 1-5 (strict integers) using this rubric:',
    RUBRIC,
    'Only include an entry in `issues` for a category scoring 3 or below — a 4 is a valid translation with cosmetic room for improvement, not an error worth flagging. Keep each issue brief: what fails, how it affects the translation, and the specific correction.',
    'Include at least one entry in `alternatives` unless all four categories scored 5 — better full translations that address the issues found.',
  ].join('\n')

  const prompt = [
    `Original (${sourceLanguage.name}): ${sentence}`,
    `Learner's translation (${targetLanguage.name}): ${translation}`,
  ].join('\n')

  return { systemPrompt, prompt }
}

export function evaluateTranslation(
  sentence: string,
  translation: string,
  provider: AIProvider,
): Promise<EvaluationResult> {
  const { systemPrompt, prompt } = buildPrompt(sentence, translation)
  return provider.generateStructured({
    systemPrompt,
    prompt,
    schema: EvaluationResultSchema,
    schemaName: 'translation_evaluation',
  })
}
