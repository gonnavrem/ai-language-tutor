import type { EvaluationResult } from '../lib/exercise/types'

export interface MockSentence {
  levelId: string
  sentence: string
  grammarPoints: string[]
  /** A good translation, and a plausible flawed one for low-scoring rows. */
  translation: string
  flawed: string
}

/** Two per CEFR level. Keyed by level id; unknown ids fall back to the lot. */
export const MOCK_SENTENCES: MockSentence[] = [
  {
    levelId: 'A1',
    sentence: 'The dog is in the garden.',
    grammarPoints: ["present simple of 'to be'", 'prepositions of place'],
    translation: 'El perro está en el jardín.',
    flawed: 'El perro es en el jardín.',
  },
  {
    levelId: 'A1',
    sentence: 'I have two brothers.',
    grammarPoints: ['present simple of "to have"', 'plural nouns'],
    translation: 'Tengo dos hermanos.',
    flawed: 'Yo tengo dos hermano.',
  },
  {
    levelId: 'A2',
    sentence: 'Yesterday we went to the market to buy fruit.',
    grammarPoints: ['simple past (irregular)', 'infinitive of purpose'],
    translation: 'Ayer fuimos al mercado a comprar fruta.',
    flawed: 'Ayer nosotros iremos al mercado para comprar fruta.',
  },
  {
    levelId: 'A2',
    sentence: 'She is taller than her sister.',
    grammarPoints: ['comparatives'],
    translation: 'Ella es más alta que su hermana.',
    flawed: 'Ella es más alto que su hermana.',
  },
  {
    levelId: 'B1',
    sentence: 'If it rains tomorrow, we will stay at home.',
    grammarPoints: ['first conditional'],
    translation: 'Si llueve mañana, nos quedaremos en casa.',
    flawed: 'Si lloverá mañana, nos quedamos en casa.',
  },
  {
    levelId: 'B1',
    sentence: 'I have been learning Spanish for three years.',
    grammarPoints: ['present perfect continuous', 'duration with "for"'],
    translation: 'Llevo tres años aprendiendo español.',
    flawed: 'He sido aprendiendo español por tres años.',
  },
  {
    levelId: 'B2',
    sentence: 'He would have called you if he had known about the problem.',
    grammarPoints: ['third conditional'],
    translation: 'Te habría llamado si hubiera sabido del problema.',
    flawed: 'Él te llamaría si sabía del problema.',
  },
  {
    levelId: 'B2',
    sentence:
      'The report, which was published last week, has been widely criticised.',
    grammarPoints: ['non-defining relative clause', 'present perfect passive'],
    translation:
      'El informe, que se publicó la semana pasada, ha sido muy criticado.',
    flawed:
      'El informe, cual fue publicado la semana pasada, está criticado ampliamente.',
  },
  {
    levelId: 'C1',
    sentence:
      'Had I realised how complicated it was, I would never have agreed to it.',
    grammarPoints: ['inverted conditional', 'would have + past participle'],
    translation:
      'De haber sabido lo complicado que era, nunca habría aceptado.',
    flawed: 'Si yo habría sabido lo complicado que era, nunca aceptaba.',
  },
  {
    levelId: 'C1',
    sentence:
      'Not only did she finish the project early, but she also exceeded every expectation.',
    grammarPoints: ['negative inversion', 'correlative conjunctions'],
    translation:
      'No solo terminó el proyecto antes de tiempo, sino que además superó todas las expectativas.',
    flawed:
      'No solamente ella terminó el proyecto temprano, pero también excedió todas expectativas.',
  },
  {
    levelId: 'C2',
    sentence:
      'Were it not for her unwavering support, the venture would scarcely have survived its first year.',
    grammarPoints: ['inverted conditional', 'negative adverb with inversion'],
    translation:
      'De no ser por su apoyo inquebrantable, la empresa apenas habría sobrevivido su primer año.',
    flawed: 'Si no era por su apoyo, la empresa no sobrevivía el primer año.',
  },
  {
    levelId: 'C2',
    sentence:
      'However much he protested, the committee remained unmoved by his arguments.',
    grammarPoints: ['concessive "however much"', 'participial complement'],
    translation:
      'Por mucho que protestara, el comité siguió sin dejarse conmover por sus argumentos.',
    flawed:
      'Aunque él protestaba mucho, el comité estaba sin moverse por sus argumentos.',
  },
]

/**
 * Canned evaluations, spread from perfect to poor so every branch of the
 * evaluation UI shows up (no issues, issues, alternatives). Prefixed "(mock)"
 * so they can never be mistaken for real feedback.
 */
export const MOCK_EVALUATIONS: EvaluationResult[] = [
  {
    scores: { meaning: 5, grammar: 5, naturalness: 5, vocabulary: 5 },
    issues: [],
    alternatives: [],
  },
  {
    scores: { meaning: 5, grammar: 4, naturalness: 4, vocabulary: 5 },
    issues: [],
    alternatives: [
      '(mock) A more idiomatic phrasing exists; a native speaker would reorder the clause.',
    ],
  },
  {
    scores: { meaning: 4, grammar: 3, naturalness: 3, vocabulary: 4 },
    issues: [
      '(mock) Noticeable calque from the English word order.',
      '(mock) One agreement error that does not block comprehension.',
    ],
    alternatives: [
      '(mock) Try restructuring the sentence the way a native speaker would say it.',
    ],
  },
  {
    scores: { meaning: 2, grammar: 2, naturalness: 3, vocabulary: 3 },
    issues: [
      '(mock) Part of the original meaning is lost.',
      '(mock) The verb tense does not match the original.',
    ],
    alternatives: ['(mock) Placeholder reference translation.'],
  },
  {
    scores: { meaning: 4, grammar: 4, naturalness: 2, vocabulary: 3 },
    issues: ['(mock) Reads like a literal, word-for-word translation.'],
    alternatives: ['(mock) A more natural alternative would avoid the calque.'],
  },
]
