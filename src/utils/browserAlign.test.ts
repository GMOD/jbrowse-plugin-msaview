import { expect, test } from 'vitest'

import {
  MAX_PAIR_CELLS,
  MAX_TOTAL_CELLS,
  alignInBrowser,
  alignToQuery,
  mergeOnQuery,
  parseFastaRecords,
} from './browserAlign'

test('an identical target sits residue for residue under the query', () => {
  const { matched, inserts } = alignToQuery('MKWVTFISLL', 'MKWVTFISLL')
  expect(matched.join('')).toBe('MKWVTFISLL')
  expect(inserts.every(i => i === '')).toBe(true)
})

test('a deletion in the target is a gap under the query', () => {
  const { matched, inserts } = alignToQuery(
    'MKWVTFISLLFLFSSAYS',
    'MKWVTLLFLFSSAYS',
  )
  expect(matched.join('').replaceAll('-', '')).toBe('MKWVTLLFLFSSAYS')
  expect(matched.filter(c => c === '-')).toHaveLength(3)
  expect(inserts.every(i => i === '')).toBe(true)
})

test('an insertion in the target lands between two query residues', () => {
  const query = 'MKWVTFISLLFLFSSAYS'
  const target = 'MKWVTFISLLGGGGFLFSSAYS'
  const { matched, inserts } = alignToQuery(query, target)
  expect(matched.join('')).toBe(query)
  expect(inserts.join('|')).toBe('|'.repeat(10) + 'GGGG' + '|'.repeat(8))
})

test('end gaps are free, so a domain-only target is not dragged across the flanks', () => {
  const query = 'AAAAAAAAAAMKWVTFISLLFLFSSAYSAAAAAAAAAA'
  const target = 'MKWVTFISLLFLFSSAYS'
  const { matched, inserts } = alignToQuery(query, target)
  expect(matched.join('')).toBe('----------MKWVTFISLLFLFSSAYS----------')
  expect(inserts.every(i => i === '')).toBe(true)
})

test('a target that overhangs the query puts the overhang in the end inserts', () => {
  const query = 'MKWVTFISLLFLFSSAYS'
  const target = 'PPPPMKWVTFISLLFLFSSAYSQQQQ'
  const { matched, inserts } = alignToQuery(query, target)
  expect(matched.join('')).toBe(query)
  expect(inserts[0]).toBe('PPPP')
  expect(inserts.at(-1)).toBe('QQQQ')
})

test('merging pads every row to the longest insert at each query position', () => {
  const query = { name: 'q', sequence: 'MKWVTF' }
  const rows = mergeOnQuery(query, [
    {
      name: 'a',
      alignment: alignToQuery(query.sequence, 'MKWGGVTF'),
    },
    {
      name: 'b',
      alignment: alignToQuery(query.sequence, 'MKWGVTF'),
    },
    {
      name: 'c',
      alignment: alignToQuery(query.sequence, 'MKWVTF'),
    },
  ])
  expect(rows.map(r => r.sequence)).toEqual([
    'MKW--VTF',
    'MKWGGVTF',
    'MKWG-VTF',
    'MKW--VTF',
  ])
  expect(new Set(rows.map(r => r.sequence.length)).size).toBe(1)
})

test('alignInBrowser returns FASTA with the query first and every row the same length', async () => {
  const progress: string[] = []
  const fasta = await alignInBrowser({
    query: { name: 'QUERY', sequence: 'MEEPQSDPSVEPPLSQETFSDLWKLLPENNV' },
    targets: [
      { name: 'a', sequence: 'MEEPQSDPSVEPPLSQETFSDLWKLLPENNV' },
      { name: 'b', sequence: 'MEPQSDPSVEPPLSQETFSDLW' },
      { name: 'c', sequence: 'SQETFSDLWKLLPENNVXXXXX' },
    ],
    onProgress: s => progress.push(s),
  })
  const records = parseFastaRecords(fasta)
  expect(records.map(r => r.name)).toEqual(['QUERY', 'a', 'b', 'c'])
  const lengths = fasta
    .split('\n')
    .filter(l => !l.startsWith('>'))
    .map(l => l.length)
  expect(new Set(lengths).size).toBe(1)
  expect(progress.length).toBeGreaterThan(0)
})

test('parseFastaRecords strips gaps and stops, and keeps the first header token', () => {
  expect(parseFastaRecords('>a desc\nMK-W*\nVT\n>b\nMM')).toEqual([
    { name: 'a', sequence: 'MKWVT' },
    { name: 'b', sequence: 'MM' },
  ])
})

test('a pair over the per-pair limit is refused before anything is aligned', async () => {
  const side = Math.ceil(Math.sqrt(MAX_PAIR_CELLS)) + 1
  const progress: string[] = []
  await expect(
    alignInBrowser({
      query: { name: 'QUERY', sequence: 'M'.repeat(side) },
      targets: [
        { name: 'short', sequence: 'MK' },
        { name: 'titin', sequence: 'M'.repeat(side) },
      ],
      onProgress: s => progress.push(s),
    }),
  ).rejects.toThrow(/titin .* too large to align in the browser.*EBI aligner/)
  expect(progress).toEqual([])
})

test('a run over the total limit is refused, naming how far over it is', async () => {
  const length = 5000
  const count = Math.ceil(MAX_TOTAL_CELLS / (length * length)) + 1
  await expect(
    alignInBrowser({
      query: { name: 'QUERY', sequence: 'M'.repeat(length) },
      targets: Array.from({ length: count }, (_, i) => ({
        name: `t${i}`,
        sequence: 'M'.repeat(length),
      })),
    }),
  ).rejects.toThrow(/too many to align in the browser: \d+M residue pairs/)
})
