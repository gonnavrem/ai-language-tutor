import type { LevelSystem } from '../schema'

export const cefr: LevelSystem = {
  id: 'cefr',
  name: 'CEFR',
  levels: [
    {
      id: 'A1',
      label: 'A1 · Beginner',
      description:
        'Can understand and use familiar everyday expressions and very basic phrases for concrete needs, using simple present-tense structures and a small, everyday vocabulary.',
    },
    {
      id: 'A2',
      label: 'A2 · Elementary',
      description:
        'Can understand sentences and frequently used expressions about immediate personal relevance (family, shopping, work, local area), using simple connected sentences and common past/future forms.',
    },
    {
      id: 'B1',
      label: 'B1 · Intermediate',
      description:
        'Can understand the main points of clear standard input on familiar matters and produce connected text on everyday topics, handling most situations likely to arise while travelling.',
    },
    {
      id: 'B2',
      label: 'B2 · Upper Intermediate',
      description:
        'Can understand the main ideas of complex text on concrete and abstract topics, interact with a degree of fluency, and produce clear, detailed text on a wide range of subjects.',
    },
    {
      id: 'C1',
      label: 'C1 · Advanced',
      description:
        'Can understand a wide range of demanding, longer texts and recognise implicit meaning, expressing ideas fluently and using language flexibly for social, academic, and professional purposes.',
    },
    {
      id: 'C2',
      label: 'C2 · Proficiency',
      description:
        'Can understand with ease virtually everything heard or read, and express themselves spontaneously, very fluently and precisely, differentiating finer shades of meaning in complex situations.',
    },
  ],
}
