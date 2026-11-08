import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../lib/db/db'
import { secureStorage } from '../lib/secureStorage'
import { saveCurrentExercise } from '../lib/exercise'
import { appConfig } from '../config'

const fetchMock = vi.fn()

function anthropicTextResponse(json: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(json) }] }),
    { status },
  )
}

/** A `Response` body can only be read once, so a fallback that answers more
 *  than one call (e.g. a real request plus its background prefetch) needs a
 *  fresh `Response` per invocation rather than a single reused one. */
function mockAnthropicFallback(json: unknown) {
  fetchMock.mockImplementation(async () => anthropicTextResponse(json))
}

// Practice pulls in requestExercise, which keeps its one-slot prefetch
// buffer as module state — reload it fresh each test so a buffer left
// behind by one `it` block can't silently answer the next test's first
// render (see the same concern in requestExercise.test.ts).
let Practice: typeof import('./Practice').Practice

beforeEach(async () => {
  localStorage.clear()
  await db.secureConfig.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)

  vi.resetModules()
  ;({ Practice } = await import('./Practice'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderPractice() {
  return render(
    <MemoryRouter>
      <Practice />
    </MemoryRouter>,
  )
}

describe('Practice', () => {
  it('prompts to configure a provider when none is saved', async () => {
    renderPractice()

    expect(
      await screen.findByText(/no ai provider configured/i),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows an already-pending exercise without generating a new one', async () => {
    saveCurrentExercise({
      id: crypto.randomUUID(),
      sentence: 'The cat sleeps.',
      levelId: appConfig.levelSystem.levels[0].id,
      grammarPoints: ['present simple'],
      aiProvider: 'anthropic',
      aiModel: 'claude-test',
    })

    renderPractice()

    expect(screen.getByText('The cat sleeps.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('generates a sentence at the default level when nothing is saved', async () => {
    await secureStorage.setProviderConfig({
      providerId: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-test',
    })
    mockAnthropicFallback({
      sentence: 'She walks to work.',
      grammarPoints: ['present simple'],
    })

    renderPractice()

    expect(await screen.findByText('She walks to work.')).toBeInTheDocument()
  })

  it('requests a new sentence when the level changes', async () => {
    await secureStorage.setProviderConfig({
      providerId: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-test',
    })
    fetchMock.mockResolvedValueOnce(
      anthropicTextResponse({
        sentence: 'A1 sentence.',
        grammarPoints: ['present simple'],
      }),
    )
    mockAnthropicFallback({
      sentence: 'B2 sentence.',
      grammarPoints: ['subjunctive'],
    })

    renderPractice()
    await screen.findByText('A1 sentence.')

    fireEvent.change(screen.getByLabelText(/level/i), {
      target: { value: 'B2' },
    })

    expect(await screen.findByText('B2 sentence.')).toBeInTheDocument()
  })

  it('regenerates a sentence at the current level', async () => {
    await secureStorage.setProviderConfig({
      providerId: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-test',
    })
    fetchMock.mockResolvedValueOnce(
      anthropicTextResponse({
        sentence: 'First.',
        grammarPoints: ['present simple'],
      }),
    )
    mockAnthropicFallback({
      sentence: 'Second.',
      grammarPoints: ['present simple'],
    })

    renderPractice()
    await screen.findByText('First.')

    fireEvent.click(screen.getByRole('button', { name: /new sentence/i }))

    expect(await screen.findByText('Second.')).toBeInTheDocument()
  })

  it('never shows the grammar points being tested', async () => {
    saveCurrentExercise({
      id: crypto.randomUUID(),
      sentence: 'The cat sleeps.',
      levelId: appConfig.levelSystem.levels[0].id,
      grammarPoints: ['present simple', 'secret grammar point'],
      aiProvider: 'anthropic',
      aiModel: 'claude-test',
    })

    renderPractice()

    expect(screen.queryByText(/secret grammar point/i)).not.toBeInTheDocument()
  })

  it('submits a translation and shows the resulting scores', async () => {
    await secureStorage.setProviderConfig({
      providerId: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-test',
    })
    saveCurrentExercise({
      id: crypto.randomUUID(),
      sentence: 'The cat sleeps.',
      levelId: appConfig.levelSystem.levels[0].id,
      grammarPoints: ['present simple'],
      aiProvider: 'anthropic',
      aiModel: 'claude-test',
    })
    fetchMock.mockResolvedValueOnce(
      anthropicTextResponse({
        scores: { meaning: 5, grammar: 3, naturalness: 5, vocabulary: 5 },
        issues: ['Minor article error.'],
        alternatives: [],
      }),
    )

    renderPractice()
    await screen.findByText('The cat sleeps.')

    fireEvent.change(screen.getByLabelText(/your translation/i), {
      target: { value: 'El gato duerme.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit translation/i }))

    expect(await screen.findByText('4.5 / 5')).toBeInTheDocument()
    expect(screen.getByText('Minor article error.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/your translation/i)).not.toBeInTheDocument()
  })

  it('keeps the typed translation after a failed submit and allows retrying', async () => {
    await secureStorage.setProviderConfig({
      providerId: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-test',
    })
    saveCurrentExercise({
      id: crypto.randomUUID(),
      sentence: 'The cat sleeps.',
      levelId: appConfig.levelSystem.levels[0].id,
      grammarPoints: ['present simple'],
      aiProvider: 'anthropic',
      aiModel: 'claude-test',
    })
    fetchMock.mockResolvedValueOnce(anthropicTextResponse({}, 500))

    renderPractice()
    await screen.findByText('The cat sleeps.')

    fireEvent.change(screen.getByLabelText(/your translation/i), {
      target: { value: 'El gato duerme.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit translation/i }))

    await screen.findByRole('alert')
    expect(screen.getByLabelText(/your translation/i)).toHaveValue(
      'El gato duerme.',
    )

    fetchMock.mockResolvedValueOnce(
      anthropicTextResponse({
        scores: { meaning: 5, grammar: 5, naturalness: 5, vocabulary: 5 },
        issues: [],
        alternatives: [],
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: /submit translation/i }))

    expect(await screen.findByText('5 / 5')).toBeInTheDocument()
  })

  it('disables regenerate and the level selector while evaluating', async () => {
    await secureStorage.setProviderConfig({
      providerId: 'anthropic',
      apiKey: 'sk-test',
      model: 'claude-test',
    })
    saveCurrentExercise({
      id: crypto.randomUUID(),
      sentence: 'The cat sleeps.',
      levelId: appConfig.levelSystem.levels[0].id,
      grammarPoints: ['present simple'],
      aiProvider: 'anthropic',
      aiModel: 'claude-test',
    })
    let resolveFetch: (value: Response) => void = () => {}
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      }),
    )

    renderPractice()
    await screen.findByText('The cat sleeps.')

    fireEvent.change(screen.getByLabelText(/your translation/i), {
      target: { value: 'El gato duerme.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit translation/i }))

    expect(
      await screen.findByRole('button', { name: /new sentence/i }),
    ).toBeDisabled()
    expect(screen.getByLabelText(/level/i)).toBeDisabled()

    resolveFetch(
      anthropicTextResponse({
        scores: { meaning: 5, grammar: 5, naturalness: 5, vocabulary: 5 },
        issues: [],
        alternatives: [],
      }),
    )

    await screen.findByText('5 / 5')
  })
})
