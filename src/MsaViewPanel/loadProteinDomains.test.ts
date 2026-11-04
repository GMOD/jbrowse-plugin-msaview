import { expect, test, vi } from 'vitest'

import { fetchProteinDomains } from '../utils/ncbiDomains'
import { loadProteinDomains } from './loadProteinDomains'

vi.mock('../utils/ncbiDomains', () => ({ fetchProteinDomains: vi.fn() }))

const MATCH = {
  signature: {
    entry: { accession: 'cd00093', name: 'HTH_XRE', description: 'a domain' },
  },
  locations: [{ start: 5, end: 40 }],
  featureType: 'Region' as const,
}

function model(treeMetadata: Record<string, Record<string, string>>) {
  return {
    rowData: treeMetadata,
    setAnnotations: vi.fn(),
  }
}

test('an accession row becomes one annotation per location, keyed by row name', async () => {
  vi.mocked(fetchProteinDomains).mockResolvedValue({
    byAccession: new Map([['NP_1', [MATCH]]]),
    failure: undefined,
  })
  const self = model({
    QUERY: { Accession: 'NP_1' },
    other: { 'Scientific name': 'Mus musculus' },
  })

  expect(await loadProteinDomains(self)).toBeUndefined()

  expect(self.setAnnotations).toHaveBeenCalledWith([
    {
      id: 'QUERY',
      accession: 'cd00093',
      name: 'HTH_XRE',
      description: 'a domain',
      featureType: 'Region',
      start: 5,
      end: 40,
    },
  ])
})

test('proteins with no CDD annotation leave the overlay alone', async () => {
  vi.mocked(fetchProteinDomains).mockResolvedValue({
    byAccession: new Map([['NP_1', []]]),
    failure: undefined,
  })
  const self = model({ QUERY: { Accession: 'NP_1' } })

  expect(await loadProteinDomains(self)).toBeUndefined()
  expect(self.setAnnotations).not.toHaveBeenCalled()
})

test('a fetch that failed outright throws its failure', async () => {
  const failure = new Error('HTTP 429 fetching efetch')
  vi.mocked(fetchProteinDomains).mockResolvedValue({
    byAccession: new Map(),
    failure,
  })
  const self = model({ QUERY: { Accession: 'NP_1' } })

  await expect(loadProteinDomains(self)).rejects.toMatchObject({
    message: 'HTTP 429 fetching efetch',
    cause: failure,
  })
  expect(self.setAnnotations).not.toHaveBeenCalled()
})

test('a fetch that half failed draws what loaded and names what did not', async () => {
  vi.mocked(fetchProteinDomains).mockResolvedValue({
    byAccession: new Map([['NP_1', [MATCH]]]),
    failure: new Error('HTTP 429 fetching efetch'),
  })
  const self = model({
    QUERY: { Accession: 'NP_1' },
    mouse: { Accession: 'NP_2' },
  })

  expect(await loadProteinDomains(self)).toBe(
    'Protein domains loaded for 1 of 2 proteins; NCBI failed on the rest: HTTP 429 fetching efetch',
  )
  expect(self.setAnnotations).toHaveBeenCalledTimes(1)
})
