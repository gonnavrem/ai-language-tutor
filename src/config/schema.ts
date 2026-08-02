import { z } from 'zod'

export const LanguageSchema = z.object({
  code: z.string().min(2).max(10),
  name: z.string().min(1),
})
export type Language = z.infer<typeof LanguageSchema>

export const LevelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
})
export type Level = z.infer<typeof LevelSchema>

export const LevelSystemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  levels: z
    .array(LevelSchema)
    .min(1, 'A level system needs at least one level')
    .refine(
      (levels) =>
        new Set(levels.map((level) => level.id)).size === levels.length,
      'Level ids must be unique within a level system',
    ),
})
export type LevelSystem = z.infer<typeof LevelSystemSchema>

export const AppConfigSchema = z
  .object({
    sourceLanguage: LanguageSchema,
    targetLanguage: LanguageSchema,
    levelSystem: LevelSystemSchema,
  })
  .refine(
    (config) => config.sourceLanguage.code !== config.targetLanguage.code,
    {
      message: 'Source and target language must be different',
      path: ['targetLanguage'],
    },
  )
export type AppConfig = z.infer<typeof AppConfigSchema>
