import { expect, test, vi } from 'vitest'

import { fetchProteinDomains } from '../utils/ncbiDomains'
import { loadProteinDomains } from './loadProteinDomains'

vi.mock('../utils/ncbiDomains', () => ({ fetchProteinDomains: vi.fn() }))

const MATCH = {
  signature: {
    entry: { accession: 'cd00093', name: 'HTH_XRE', description: 'a domain' },
  },
  locations: [{ start: 5, end: 40 }],
}

function model(treeMetadata: Record<string, Record<string, string>>) {
  return {
    data: { treeMetadata: JSON.stringify(treeMetadata) },
    setProgress: vi.fn(),
    setAnnotations: vi.fn(),
  }
}

test('an accession row becomes one annotation per location, keyed by row name', async () => {
  vi.mocked(fetchProteinDomains).mockResolvedValue(new Map([['NP_1', [MATCH]]]))
  const self = model({
    QUERY: { Accession: 'NP_1' },
    other: { 'Scientific name': 'Mus musculus' },
  })

  await loadProteinDomains(self)

  expect(self.setAnnotations).toHaveBeenCalledWith([
    {
      id: 'QUERY',
      accession: 'cd00093',
      name: 'HTH_XRE',
      description: 'a domain',
      start: 5,
      end: 40,
    },
  ])
})

test('says so rather than clearing the overlay when NCBI has nothing', async () => {
  vi.mocked(fetchProteinDomains).mockResolvedValue(new Map())
  const self = model({ QUERY: { Accession: 'NP_1' } })

  await expect(loadProteinDomains(self)).rejects.toThrow(
    'No CDD domain annotations found',
  )
  expect(self.setAnnotations).not.toHaveBeenCalled()
})
