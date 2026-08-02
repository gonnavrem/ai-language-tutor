import { AppConfigSchema, type AppConfig } from './schema'
import { cefr } from './levels/cefr'

const rawConfig: AppConfig = {
  sourceLanguage: { code: 'en', name: 'English' },
  targetLanguage: { code: 'es', name: 'Spanish' },
  levelSystem: cefr,
}

export const appConfig = AppConfigSchema.parse(rawConfig)
