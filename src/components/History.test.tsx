import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../lib/db/db'
import { sampleRecord } from '../test/fixtures'
import { History } from './History'

beforeEach(async () => {
  await db.exercises.clear()
})

describe('History', () => {
  it('shows an empty state when nothing has been solved', async () => {
    render(<History />)

    expect(await screen.findByText(/no exercises yet/i)).toBeInTheDocument()
  })

  it('lists exercises newest first with their overall score', async () => {
    await db.exercises.bulkAdd([
      sampleRecord({ sentence: 'Old.' }),
      sampleRecord({ sentence: 'New.', solvedAt: new Date('2026-02-01') }),
    ])

    render(<History />)

    const rows = await screen.findAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('New.')
    expect(rows[1]).toHaveTextContent('Old.')
    expect(rows[0]).toHaveTextContent('5 / 5')
  })

  it('reveals translation and grammar points only when a row is expanded', async () => {
    await db.exercises.add(sampleRecord())

    render(<History />)
    const row = await screen.findByRole('button', { name: /the cat/i })
    expect(screen.queryByText(/present continuous/)).not.toBeInTheDocument()

    fireEvent.click(row)

    expect(screen.getByText(/present continuous/)).toBeInTheDocument()
    expect(screen.getByText(/el gato está durmiendo/i)).toBeInTheDocument()
  })

  it('filters by level, including ids no longer in the config', async () => {
    await db.exercises.bulkAdd([
      sampleRecord({ sentence: 'Beginner.', levelId: 'A1' }),
      sampleRecord({ sentence: 'Orphan.', levelId: 'Z9' }),
    ])

    render(<History />)
    await screen.findByText('Orphan.')
    expect(screen.getAllByText(/no longer in config/i)).not.toHaveLength(0)

    fireEvent.change(screen.getByLabelText(/level/i), {
      target: { value: 'Z9' },
    })

    expect(screen.getByText('Orphan.')).toBeInTheDocument()
    expect(screen.queryByText('Beginner.')).not.toBeInTheDocument()
  })

  it('says so when the level filter matches nothing, not "no exercises yet"', async () => {
    await db.exercises.add(sampleRecord({ levelId: 'A1' }))

    render(<History />)
    await screen.findByText(/the cat/i)
    fireEvent.change(screen.getByLabelText(/level/i), {
      target: { value: 'C2' },
    })

    expect(screen.getByText(/no exercises at this level/i)).toBeInTheDocument()
    expect(screen.queryByText(/no exercises yet/i)).not.toBeInTheDocument()
  })

  it('shows the overall score once: in the row when collapsed, in the detail when expanded', async () => {
    await db.exercises.add(sampleRecord())

    render(<History />)
    const row = await screen.findByRole('button', { name: /the cat/i })
    expect(screen.getAllByText('5 / 5')).toHaveLength(1)

    fireEvent.click(row)

    expect(screen.getAllByText('5 / 5')).toHaveLength(1)
    expect(row).not.toHaveTextContent('5 / 5')
  })

  it('deletes a single exercise only after a confirmation', async () => {
    await db.exercises.bulkAdd([
      sampleRecord({ sentence: 'Keep.' }),
      sampleRecord({ sentence: 'Remove.' }),
    ])

    render(<History />)
    fireEvent.click(await screen.findByRole('button', { name: /remove/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(await db.exercises.count()).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() =>
      expect(screen.queryByText('Remove.')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Keep.')).toBeInTheDocument()
  })

  it('cancelling a single delete keeps the exercise', async () => {
    await db.exercises.add(sampleRecord({ sentence: 'Keep.' }))

    render(<History />)
    fireEvent.click(await screen.findByRole('button', { name: /keep/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(
      screen.getByRole('button', { name: /^delete$/i }),
    ).toBeInTheDocument()
    expect(await db.exercises.count()).toBe(1)
  })

  it('deletes everything only after a second confirmation', async () => {
    await db.exercises.bulkAdd([sampleRecord(), sampleRecord()])

    render(<History />)
    fireEvent.click(await screen.findByRole('button', { name: /delete all/i }))
    expect(await db.exercises.count()).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(await screen.findByText(/no exercises yet/i)).toBeInTheDocument()
    expect(await db.exercises.count()).toBe(0)
  })

  it('scopes "delete all" to the active level filter', async () => {
    await db.exercises.bulkAdd([
      sampleRecord({ sentence: 'Beginner one.', levelId: 'A1' }),
      sampleRecord({ sentence: 'Beginner two.', levelId: 'A1' }),
      sampleRecord({ sentence: 'Advanced.', levelId: 'C1' }),
    ])

    render(<History />)
    await screen.findByText('Advanced.')
    fireEvent.change(screen.getByLabelText(/level/i), {
      target: { value: 'A1' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /delete all at this level/i }),
    )
    expect(screen.getByText(/delete all 2 A1 exercises\?/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(async () => {
      const remaining = await db.exercises.toArray()
      expect(remaining.map((r) => r.sentence)).toEqual(['Advanced.'])
    })
  })

  it('shows an error and keeps the prompt when deleting fails', async () => {
    await db.exercises.add(sampleRecord())
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.exercises, 'clear').mockRejectedValueOnce(new Error('blocked'))

    render(<History />)
    fireEvent.click(await screen.findByRole('button', { name: /delete all/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /couldn't delete/i,
    )
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument()
    expect(await db.exercises.count()).toBe(1)
    vi.restoreAllMocks()
  })
})
