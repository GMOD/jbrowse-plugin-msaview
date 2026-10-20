import { expect, test } from 'vitest'

import { sessionHighlightsOnQueryRow } from './sessionHighlights'

import type { GenomeHighlight, QueryOnGenome } from './sessionHighlights'

// minus strand: residue 0 on bases 109..107, residue 1 on 106..104, residue 2
// on 103..101
const g2p: Record<number, number> = {}
for (let base = 101; base < 110; base++) {
  g2p[base] = Math.floor((109 - base) / 3)
}
const transcript: QueryOnGenome = {
  kind: 'transcript',
  map: { g2p, refName: 'chr12' },
}

function onRow(
  highlights: GenomeHighlight[],
  { onGenome = transcript, querySeqOffset = 0, labels = true } = {},
) {
  return sessionHighlightsOnQueryRow({
    highlights,
    onGenome,
    querySeqName: 'human_query',
    querySeqOffset,
    sameAssembly: name => name === 'hg38',
    sameRefName: refName => refName.replace(/^chr/, '') === '12',
    labels,
  })
}

const codon = (start: number, label?: string): GenomeHighlight => ({
  assemblyName: 'hg38',
  refName: 'chr12',
  start,
  end: start + 3,
  label,
})

test('a codon labels the residue it codes, 1-based on the query row', () => {
  expect(onRow([codon(104, 'G12')])).toEqual([
    { row: 'human_query', start: 2, end: 2, label: 'G12' },
  ])
})

test('a query row holding part of the protein shifts by its offset', () => {
  expect(onRow([codon(101)], { querySeqOffset: 1 })).toEqual([
    { row: 'human_query', start: 2, end: 2 },
  ])
})

test('a region over several residues is one span per consecutive run', () => {
  expect(
    onRow([{ assemblyName: 'hg38', refName: '12', start: 101, end: 110 }]),
  ).toEqual([{ row: 'human_query', start: 1, end: 3 }])
})

test('a highlight on another chromosome, assembly or off the CDS draws nothing', () => {
  expect(
    onRow([
      { ...codon(104), refName: 'chr7' },
      { ...codon(104), assemblyName: 'mm39' },
      codon(200),
    ]),
  ).toEqual([])
})

test('a MAF query row counts bases from the block start', () => {
  expect(
    onRow([codon(1005, 'site')], {
      onGenome: { kind: 'maf', refName: 'chr12', start: 1000, end: 1010 },
    }),
  ).toEqual([{ row: 'human_query', start: 6, end: 8, label: 'site' }])
})

test('labels turned off in the session keep the span and drop its text', () => {
  expect(onRow([codon(104, 'G12')], { labels: false })).toEqual([
    { row: 'human_query', start: 2, end: 2 },
  ])
})
