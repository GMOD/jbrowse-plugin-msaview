// @vitest-environment jsdom
import React from 'react'

import { SimpleFeature } from '@jbrowse/core/util'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { useFeatureSequence } from '../useFeatureSequence'
import PreLoadedMSA from './PreLoadedMSADataPanel'
import { fetchMSA, fetchMSAList } from './fetchMSAData'

import type { AbstractTrackModel } from '@jbrowse/core/util'

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({ jbrowse: {} }),
  getEnv: () => ({ pluginManager: {} }),
  getContainingView: () => ({ id: 'lgv', assemblyNames: ['hg38'] }),
}))
vi.mock('./types', () => ({
  readMsaDatasets: () => [
    { datasetId: 'd1', name: 'Dataset', description: '', adapter: {} },
  ],
}))
vi.mock('./fetchMSAData', () => ({
  fetchMSAList: vi.fn(),
  fetchMSA: vi.fn(),
}))
vi.mock('../useFeatureSequence', () => ({
  useFeatureSequence: vi.fn(),
}))

const protein = 'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD'

beforeEach(() => {
  localStorage.clear()
  vi.mocked(useFeatureSequence).mockReturnValue({
    proteinSequence: '',
    error: undefined,
    isLoading: true,
  })
  vi.mocked(fetchMSA).mockResolvedValue({
    msa: `>NM_1_hg38\n${'W'.repeat(protein.length)}\n>other\n${protein}\n`,
  })
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

function renderPanel() {
  render(
    <PreLoadedMSA handleClose={() => {}} model={model} feature={feature} />,
  )
}

test('waits for the translation before launching on the fallback row', async () => {
  vi.mocked(fetchMSAList).mockResolvedValue(['NM_1'])
  renderPanel()
  await screen.findByLabelText('MSA row matching the selected transcript')
  expect(
    screen.getByRole('button', { name: 'Submit' }).hasAttribute('disabled'),
  ).toBe(true)
  expect(screen.queryByText(/no row matches this transcript/)).toBeNull()
  expect(screen.queryByText(/No row matched/)).toBeNull()
})

test('says why Submit is grey when the dataset has nothing for the gene', async () => {
  vi.mocked(fetchMSAList).mockResolvedValue(['ENST_unrelated'])
  renderPanel()
  expect(
    await screen.findByText('this dataset has no alignment for this gene'),
  ).toBeTruthy()
})
