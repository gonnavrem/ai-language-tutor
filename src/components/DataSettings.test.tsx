import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import v1Fixture from '../lib/backup/fixtures/backup-v1.json?raw'
import { db } from '../lib/db/db'
import { DataSettings } from './DataSettings'

beforeEach(async () => {
  localStorage.clear()
  await db.exercises.clear()
})

function pickFile(contents: string) {
  fireEvent.change(screen.getByLabelText(/import history/i), {
    target: { files: [new File([contents], 'backup.json')] },
  })
}

describe('DataSettings', () => {
  it('disables export while there is nothing to export', async () => {
    render(<DataSettings />)

    expect(
      await screen.findByText(/nothing to export yet/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled()
  })

  it('summarizes a picked file and imports it only on confirmation', async () => {
    render(<DataSettings />)

    pickFile(v1Fixture)

    expect(
      await screen.findByText(/2 new, 0 already present/i),
    ).toBeInTheDocument()
    expect(await db.exercises.count()).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }))

    expect(await screen.findByText(/imported 2 exercises/i)).toBeInTheDocument()
    expect(await db.exercises.count()).toBe(2)
  })

  it('explains why a file was rejected', async () => {
    render(<DataSettings />)

    pickFile('{"hello":"world"}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /isn't a language tutor backup/i,
    )
  })
})
