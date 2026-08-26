import { expect, test } from 'vitest'

import { describeSearch } from './CachedBlastResults'

import type { CachedBlastResult } from '../../../utils/blastCache'

const base: CachedBlastResult = {
  id: 'k',
  proteinSequence: 'MKV',
  blastDatabase: 'uniprotkb_swissprot',
  msa: '',
  tree: '',
  treeMetadata: '{}',
  rid: 'r',
  timestamp: 0,
}

function row(fields: Partial<CachedBlastResult>): CachedBlastResult {
  return { ...base, ...fields }
}

test('a blastp row names its database, program and aligner', () => {
  expect(
    describeSearch(row({ searchProgram: 'blastp', msaAlgorithm: 'muscle' })),
  ).toBe('uniprotkb_swissprot / blastp / muscle')
})

// phmmer aligns as it searches, so its rows carry no msaAlgorithm at all --
// which read as "(undefined)" while this assumed one
test('a phmmer row names no aligner, because none ran', () => {
  expect(
    describeSearch(
      row({ blastDatabase: 'swissprot', searchProgram: 'phmmer' }),
    ),
  ).toBe('swissprot / phmmer')
})

test('a row cached before searchProgram existed reads as blastp', () => {
  expect(describeSearch(row({ msaAlgorithm: 'clustalo' }))).toBe(
    'uniprotkb_swissprot / blastp / clustalo',
  )
})

test('a row from the NCBI era keeps the program it recorded', () => {
  expect(
    describeSearch(
      row({ blastProgram: 'quick-blastp', msaAlgorithm: 'clustalo' }),
    ),
  ).toBe('uniprotkb_swissprot / quick-blastp / clustalo')
})
