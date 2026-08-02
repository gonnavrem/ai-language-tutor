import { describe, expect, it } from 'vitest'
import { AppConfigSchema } from './schema'
import { appConfig } from './app.config'

describe('appConfig (reference instance)', () => {
  it('is a valid, parsed English -> Spanish CEFR config', () => {
    expect(appConfig.sourceLanguage.code).toBe('en')
    expect(appConfig.targetLanguage.code).toBe('es')
    expect(appConfig.levelSystem.id).toBe('cefr')
    expect(appConfig.levelSystem.levels).toHaveLength(6)
    expect(appConfig.levelSystem.levels.map((level) => level.id)).toEqual([
      'A1',
      'A2',
      'B1',
      'B2',
      'C1',
      'C2',
    ])
  })
})

describe('AppConfigSchema', () => {
  const base = {
    sourceLanguage: { code: 'en', name: 'English' },
    targetLanguage: { code: 'es', name: 'Spanish' },
    levelSystem: {
      id: 'test',
      name: 'Test system',
      levels: [{ id: 'L1', label: 'Level 1', description: 'First level' }],
    },
  }

  it('rejects a level system with no levels', () => {
    const result = AppConfigSchema.safeParse({
      ...base,
      levelSystem: { ...base.levelSystem, levels: [] },
    })
    expect(result.success).toBe(false)
  })

  it('rejects duplicate level ids', () => {
    const result = AppConfigSchema.safeParse({
      ...base,
      levelSystem: {
        ...base.levelSystem,
        levels: [
          { id: 'L1', label: 'Level 1', description: 'First level' },
          { id: 'L1', label: 'Level 1 again', description: 'Duplicate id' },
        ],
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects source and target languages being the same', () => {
    const result = AppConfigSchema.safeParse({
      ...base,
      targetLanguage: { code: 'en', name: 'English' },
    })
    expect(result.success).toBe(false)
  })
})
