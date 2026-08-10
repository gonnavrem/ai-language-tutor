import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderSettings } from './ProviderSettings'
import { db } from '../lib/db/db'
import { secureStorage } from '../lib/secureStorage'
import type { ProviderConfig } from '../lib/ai'

const fetchMock = vi.fn()

beforeEach(async () => {
  await db.secureConfig.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function anthropicTextResponse(text: string, status = 200): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status,
  })
}

describe('ProviderSettings', () => {
  it('defaults to the first preset when nothing is saved', () => {
    render(<ProviderSettings />)

    expect(screen.getByText(/bring your own api key/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/provider/i)).toHaveValue('anthropic')
    expect(screen.getByLabelText(/model/i)).toHaveValue('claude-haiku-4-5')
  })

  it('loads a saved config without prefilling the api key field', async () => {
    const saved: ProviderConfig = {
      providerId: 'google',
      apiKey: 'goog-real-key',
      model: 'gemini-2.5-flash',
    }
    await secureStorage.setProviderConfig(saved)

    render(<ProviderSettings />)

    await waitFor(() =>
      expect(screen.getByText(/a provider is configured/i)).toBeInTheDocument(),
    )
    expect(screen.getByLabelText(/provider/i)).toHaveValue('google')
    expect(screen.getByLabelText(/model/i)).toHaveValue('gemini-2.5-flash')
    const keyInput = screen.getByPlaceholderText(
      /saved.*enter a new key/i,
    ) as HTMLInputElement
    expect(keyInput.value).toBe('')
  })

  it('resets model and base url when switching presets', () => {
    render(<ProviderSettings />)

    fireEvent.change(screen.getByLabelText(/provider/i), {
      target: { value: 'deepseek' },
    })

    expect(screen.getByLabelText(/model/i)).toHaveValue('deepseek-v4-flash')
    expect(screen.getByLabelText(/base url/i)).toHaveValue(
      'https://api.deepseek.com',
    )
  })

  it('only shows a base url field for openai-compatible presets', () => {
    render(<ProviderSettings />)
    expect(screen.queryByLabelText(/base url/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/provider/i), {
      target: { value: 'custom' },
    })
    expect(screen.getByLabelText(/base url/i)).not.toHaveAttribute('readonly')
  })

  it('rejects saving without an api key', () => {
    render(<ProviderSettings />)

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Saved.')).not.toBeInTheDocument()
  })

  it('saves a valid config to secure storage', async () => {
    render(<ProviderSettings />)

    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-ant-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument())
    expect(await secureStorage.getProviderConfig()).toEqual({
      providerId: 'anthropic',
      apiKey: 'sk-ant-123',
      model: 'claude-haiku-4-5',
    })
  })

  it('shows success after a working test connection', async () => {
    fetchMock.mockResolvedValueOnce(
      anthropicTextResponse(JSON.stringify({ ok: true })),
    )
    render(<ProviderSettings />)

    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-ant-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() =>
      expect(screen.getByText(/connection succeeded/i)).toBeInTheDocument(),
    )
  })

  it('clears a stale connection result when saving', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"bad key"}', { status: 401 }),
    )
    render(<ProviderSettings />)

    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-ant-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))
    await waitFor(() =>
      expect(screen.getByText(/http 401/i)).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => expect(screen.getByText('Saved.')).toBeInTheDocument())
    expect(screen.queryByText(/http 401/i)).not.toBeInTheDocument()
  })

  it('surfaces the http status when a test connection fails', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"error":"bad key"}', { status: 401 }),
    )
    render(<ProviderSettings />)

    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-ant-123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /test connection/i }))

    await waitFor(() =>
      expect(screen.getByText(/http 401/i)).toBeInTheDocument(),
    )
  })
})
