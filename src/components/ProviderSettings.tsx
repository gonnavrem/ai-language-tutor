import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react'
import { z } from 'zod'
import {
  AIProviderError,
  AIRequestError,
  StructuredOutputError,
  ProviderConfigSchema,
  createProvider,
  providerPresets,
  type ProviderConfig,
} from '../lib/ai'
import { secureStorage } from '../lib/secureStorage'

const testSchema = z.object({ ok: z.boolean() })

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'success' }
  | { status: 'error'; message: string }

function findPresetForConfig(config: ProviderConfig) {
  return (
    providerPresets.find(
      (p) => p.providerId === config.providerId && p.baseUrl === config.baseUrl,
    ) ?? providerPresets.find((p) => p.providerId === config.providerId)
  )
}

export function ProviderSettings() {
  const [presetId, setPresetId] = useState(providerPresets[0].id)
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [model, setModel] = useState(providerPresets[0].defaultModel)
  const [baseUrl, setBaseUrl] = useState('')
  const [hasSavedConfig, setHasSavedConfig] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{
    kind: 'success' | 'error'
    text: string
  } | null>(null)
  const [testState, setTestState] = useState<TestState>({ status: 'idle' })

  const preset =
    providerPresets.find((p) => p.id === presetId) ?? providerPresets[0]

  useEffect(() => {
    secureStorage.getProviderConfig().then((config) => {
      if (!config) return
      const matched = findPresetForConfig(config)
      if (!matched) return
      setHasSavedConfig(true)
      setPresetId(matched.id)
      setModel(config.model)
      setBaseUrl(config.baseUrl ?? matched.baseUrl ?? '')
    })
  }, [])

  function handlePresetChange(nextId: string) {
    const next = providerPresets.find((p) => p.id === nextId)
    if (!next) return
    setPresetId(nextId)
    setModel(next.defaultModel)
    setBaseUrl(next.baseUrl ?? '')
    setSaveMessage(null)
    setTestState({ status: 'idle' })
  }

  function buildConfig(): { config: ProviderConfig } | { error: string } {
    const result = ProviderConfigSchema.safeParse({
      providerId: preset.providerId,
      apiKey,
      model,
      baseUrl: preset.providerId === 'openai-compatible' ? baseUrl : undefined,
    })
    if (!result.success) return { error: z.prettifyError(result.error) }
    return { config: result.data }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    setTestState({ status: 'idle' })
    const built = buildConfig()
    if ('error' in built) {
      setSaveMessage({ kind: 'error', text: built.error })
      return
    }
    await secureStorage.setProviderConfig(built.config)
    setHasSavedConfig(true)
    setSaveMessage({ kind: 'success', text: 'Saved.' })
  }

  async function handleTestConnection() {
    setSaveMessage(null)
    const built = buildConfig()
    if ('error' in built) {
      setTestState({
        status: 'error',
        message: 'Fill in a valid API key and model first.',
      })
      return
    }
    setTestState({ status: 'testing' })
    try {
      await createProvider(built.config).generateStructured({
        systemPrompt: 'Reply only with JSON matching the requested schema.',
        prompt: 'Return {"ok": true}.',
        schema: testSchema,
        schemaName: 'connection_test',
      })
      setTestState({ status: 'success' })
    } catch (err) {
      if (err instanceof AIRequestError) {
        setTestState({
          status: 'error',
          message: `Provider returned HTTP ${err.status}: ${err.responseBody.slice(0, 200)}`,
        })
      } else if (err instanceof StructuredOutputError) {
        setTestState({
          status: 'error',
          message: 'The model responded, but not in the expected format.',
        })
      } else if (err instanceof AIProviderError) {
        setTestState({ status: 'error', message: err.message })
      } else {
        setTestState({
          status: 'error',
          message: 'Unexpected error — see console.',
        })
        console.error(err)
      }
    }
  }

  const showBaseUrl = preset.providerId === 'openai-compatible'

  return (
    <form
      onSubmit={handleSave}
      className="mx-auto flex w-full max-w-md flex-col gap-4 p-6"
    >
      <div>
        <h1 className="text-xl font-medium">AI Provider</h1>
        <p className="text-sm text-gray-500">
          {hasSavedConfig
            ? 'A provider is configured. Enter your API key again to change anything.'
            : 'Bring your own API key to enable exercise generation and evaluation.'}
        </p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Provider</span>
        <select
          value={presetId}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        >
          {providerPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">API key</span>
        <div className="flex gap-2">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              hasSavedConfig ? 'Saved — enter a new key to change' : 'sk-...'
            }
            className="flex-1 rounded border border-gray-300 px-3 py-2"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowApiKey((v) => !v)}
            aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            className="rounded border border-gray-300 px-2"
          >
            {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Model</span>
        <input
          list={`${preset.id}-models`}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <datalist id={`${preset.id}-models`}>
          {preset.suggestedModels.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </label>

      {showBaseUrl && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Base URL</span>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            readOnly={!preset.baseUrlEditable}
            className="rounded border border-gray-300 px-3 py-2 read-only:bg-gray-100 read-only:text-gray-500"
          />
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={testState.status === 'testing'}
          className="flex items-center gap-2 rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
        >
          {testState.status === 'testing' && (
            <Loader2 size={16} className="animate-spin" />
          )}
          Test connection
        </button>
      </div>

      {saveMessage && (
        <p
          role="alert"
          className={
            saveMessage.kind === 'error'
              ? 'text-sm text-red-600'
              : 'text-sm text-green-600'
          }
        >
          {saveMessage.text}
        </p>
      )}

      {testState.status === 'success' && (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-green-600"
        >
          <CheckCircle2 size={16} /> Connection succeeded.
        </p>
      )}
      {testState.status === 'error' && (
        <p
          role="alert"
          className="flex items-center gap-1 text-sm text-red-600"
        >
          <XCircle size={16} /> {testState.message}
        </p>
      )}
    </form>
  )
}
