import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { db } from './lib/db/db'

beforeEach(async () => {
  localStorage.clear()
  await db.secureConfig.clear()
})

describe('App', () => {
  it('renders the practice screen by default', async () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Practice' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/no ai provider configured/i),
    ).toBeInTheDocument()
  })

  it('navigates to provider settings', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('link', { name: /settings/i }))

    expect(screen.getByText('AI Provider')).toBeInTheDocument()
  })
})
