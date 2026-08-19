import { describe, expect, test } from 'vitest'

import { detectQueryRow, getMsaRowNames } from './detectQueryRow'

const protein = 'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD'

// COBALT renames the query `Query_1`, so only the residues identify it
const clustal = `CLUSTAL W (1.81) multiple sequence alignment

Query_1         MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD
sp|P02769|ALBU  MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPYD
sp|Q5XLE4|OTHE  MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLWWCPFD
`

const fasta = `>Query_1
MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD
>sp|P02769|ALBU_BOVIN
MKWVTFISLLLLFSSAYSRG--RRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPYD
`

describe('detectQueryRow', () => {
  test('finds the query by sequence when the aligner renamed it', () => {
    expect(detectQueryRow(clustal, protein)).toMatchObject({
      name: 'Query_1',
      quality: 'exact',
    })
  })

  test('ignores gaps in the aligned row', () => {
    expect(detectQueryRow(fasta, protein)?.name).toBe('Query_1')
  })

  test('tolerates the trailing stop codon the translation carries', () => {
    expect(detectQueryRow(clustal, `${protein}*`)?.name).toBe('Query_1')
  })

  test('matches a row that is the query trimmed to the aligned region', () => {
    const trimmed = `>hit_one\nWRONGWRONGWRONGWRONG\n>aligned_query\n${protein.slice(5, 40)}\n`
    expect(detectQueryRow(trimmed, protein)).toMatchObject({
      name: 'aligned_query',
      quality: 'partial',
    })
  })

  // the failure that matters: silently wiring the view to a homolog would look
  // like it worked, and every navigation afterwards would land in the wrong place
  test('returns nothing when only diverged homologs are present', () => {
    const homologsOnly = `>hit_one
MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD
>hit_two
MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFD
`
    expect(
      detectQueryRow(homologsOnly, 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW'),
    ).toBeUndefined()
  })

  test('returns nothing rather than throwing on a half-pasted alignment', () => {
    expect(detectQueryRow('>partial\nMKWV', protein)).toBeUndefined()
    expect(detectQueryRow('not an alignment at all', protein)).toBeUndefined()
    expect(detectQueryRow('', protein)).toBeUndefined()
    expect(detectQueryRow(clustal, '')).toBeUndefined()
  })
})

describe('getMsaRowNames', () => {
  test('lists the rows for the override dropdown', () => {
    expect(getMsaRowNames(clustal)).toEqual([
      'Query_1',
      'sp|P02769|ALBU',
      'sp|Q5XLE4|OTHE',
    ])
  })

  test('is empty rather than throwing while the user is still pasting', () => {
    expect(getMsaRowNames('CLUSTAL W')).toEqual([])
    expect(getMsaRowNames('')).toEqual([])
  })
})
