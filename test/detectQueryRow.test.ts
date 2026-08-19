import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import { detectQueryRow } from '../src/LaunchMsaView/detectQueryRow'

// Real EBI clustalo output rather than a hand-written fixture: `aln-clustal_num`
// carries a residue count in a trailing column, and the parser has to drop it
// before the sequences compare equal. This lives under test/ because reading it
// needs node APIs the src/ tsconfig does not carry.
describe('detectQueryRow against real aligner output', () => {
  const albumin = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'ebi-clustalo-albumin.aln'),
    'utf8',
  )
  const query =
    'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFDEHVKLVNELTEFAK'

  test('finds the query row in clustal_num output', () => {
    expect(detectQueryRow(albumin, query)).toMatchObject({
      name: 'QUERY_ALBUMIN',
      quality: 'exact',
    })
  })

  // the rows here are ~90%-identical albumins, so a detector that simply took
  // the best-scoring row would hand back a homolog with total confidence
  test('declines an unrelated protein despite near-identical rows', () => {
    const p53 = 'MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDPGP'
    expect(detectQueryRow(albumin, p53)).toBeUndefined()
  })
})
