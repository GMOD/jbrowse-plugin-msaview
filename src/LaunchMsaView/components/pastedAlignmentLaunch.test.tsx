// @vitest-environment jsdom
import React from 'react'

import { SimpleFeature } from '@jbrowse/core/util'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { launchMsaView } from '../../utils/launchMsaView'
import BlastManualPanel from './BlastQuery/BlastManualPanel'
import ManualMSALoader from './ManualMSALoader/ManualMSALoader'
import { useFeatureSequence } from './useFeatureSequence'

import type { AbstractTrackModel } from '@jbrowse/core/util'

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({}),
  getContainingView: () => ({ id: 'lgv', assemblyNames: ['hg38'] }),
}))
vi.mock('../../utils/launchMsaView', () => ({
  launchMsaView: vi.fn(),
}))
vi.mock('./useFeatureSequence', () => ({
  useFeatureSequence: vi.fn(),
}))

const protein = 'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD'
const alignment = `>aligned_query\n${protein}\n>other\n${'W'.repeat(protein.length)}\n`

const mockSequence = vi.mocked(useFeatureSequence)
const mockLaunch = vi.mocked(launchMsaView)

function translation(state: 'loading' | 'ready') {
  mockSequence.mockReturnValue({
    proteinSequence: state === 'ready' ? protein : '',
    error: undefined,
    isLoading: state === 'loading',
  })
}

beforeEach(() => {
  localStorage.clear()
  mockLaunch.mockReset()
  mockLaunch.mockReturnValue(new Promise(() => {}))
})

afterEach(() => {
  cleanup()
})

const feature = new SimpleFeature({
  uniqueId: 'gene1',
  name: 'TP53',
  refName: 'chr1',
  start: 0,
  end: 180,
  type: 'gene',
  subfeatures: [
    {
      uniqueId: 'tx1',
      name: 'NM_1',
      refName: 'chr1',
      start: 0,
      end: 180,
      type: 'mRNA',
      subfeatures: [
        { uniqueId: 'cds1', refName: 'chr1', start: 0, end: 180, type: 'CDS' },
      ],
    },
  ],
})
const model = {} as unknown as AbstractTrackModel

function renderBlastManual() {
  return render(
    <BlastManualPanel handleClose={() => {}} model={model} feature={feature}>
      {null}
    </BlastManualPanel>,
  )
}

function renderManualLoader() {
  const rendered = render(
    <ManualMSALoader handleClose={() => {}} model={model} feature={feature} />,
  )
  fireEvent.click(screen.getByLabelText('Paste text'))
  return rendered
}

function paste() {
  fireEvent.change(screen.getByLabelText('Alignment'), {
    target: { value: alignment },
  })
}

function submitButton() {
  return screen.getByRole('button', { name: 'Submit' })
}

test.each([
  ['BLAST manual', renderBlastManual],
  ['Manual upload', renderManualLoader],
])(
  '%s keeps Submit grey until the protein it matches rows by has arrived',
  (_name, renderPanel) => {
    translation('loading')
    renderPanel()
    paste()
    expect(submitButton()).toHaveProperty('disabled', true)
    expect(screen.queryByText(/No row matched/)).toBeNull()
  },
)

test('BLAST manual launches with the row the arrived protein matches', () => {
  translation('loading')
  const { rerender } = renderBlastManual()
  paste()
  translation('ready')
  rerender(
    <BlastManualPanel handleClose={() => {}} model={model} feature={feature}>
      {null}
    </BlastManualPanel>,
  )
  fireEvent.click(submitButton())
  expect(mockLaunch.mock.calls[0]?.[1].querySeqName).toBe('aligned_query')
})

test('BLAST manual says the protein is on its way rather than asking for a transcript', () => {
  translation('loading')
  renderBlastManual()
  expect(screen.queryByText(/Pick a transcript/)).toBeNull()
  expect(screen.getAllByText(/Translating transcript/).length).toBeGreaterThan(
    0,
  )
})
