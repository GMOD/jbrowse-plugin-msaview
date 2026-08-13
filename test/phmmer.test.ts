import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import {
  isPhmmerJobId,
  parsePhmmerAlignment,
  phmmerResultUrl,
} from '../src/utils/phmmer'

function fixture(name: string) {
  return readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'fixtures', name),
    'utf8',
  )
}

// A real https://www.ebi.ac.uk/Tools/services/rest/hmmer3_phmmer .sto for human
// albumin against swissprot, trimmed to five rows: the query's own entry, an
// ordinary hit, a hit whose description carries no GN=, and two rows that are
// the same accession matched in two places. The annotation names (#=GC RF, the
// OS=/OX= on #=GS DE) are the whole risk in this mapping, and nothing else in
// CI would notice if HMMER or EBI changed one.
const stockholm = fixture('hmmer3-phmmer-albumin.sto')
const query = fixture('uniprot-P02768.fa')
  .split('\n')
  .slice(1)
  .join('')
  .replaceAll(/\s/g, '')

describe('parsePhmmerAlignment', () => {
  test('maps a hit onto the shape the MSA rows are built from', () => {
    const { rows } = parsePhmmerAlignment({ stockholm, query })

    expect(rows[1]).toMatchObject({
      accession: 'P02769',
      id: 'ALBU_BOVIN',
      sciname: 'Bos taurus',
      taxid: 9913,
      title: 'Albumin',
      range: '1-606',
    })
  })

  test('reads a description that has no gene name', () => {
    const { rows } = parsePhmmerAlignment({ stockholm, query })

    expect(rows[2]).toMatchObject({
      accession: 'Q3T478',
      sciname: 'Bombina maxima',
      taxid: 161274,
      title: 'Serum albumin',
    })
  })

  test('keeps one row per matched region of the same target', () => {
    const { rows } = parsePhmmerAlignment({ stockholm, query })
    const petma = rows.filter(r => r.accession === 'Q91274')

    expect(petma.map(r => r.range)).toEqual(['12-489', '503-912'])
  })

  test('uppercases insert columns and turns . gaps into -', () => {
    const { rows } = parsePhmmerAlignment({ stockholm, query })

    // the renderer looks colors up by the literal letter, so a lowercase insert
    // residue would draw uncolored
    expect(rows.every(r => !/[a-z.]/.test(r.aligned))).toBe(true)
  })

  test('every row is the same width as the query row', () => {
    const { rows, queryRow } = parsePhmmerAlignment({ stockholm, query })

    expect(new Set(rows.map(r => r.aligned.length))).toEqual(
      new Set([queryRow.length]),
    )
  })

  // phmmer leaves the query out of its own alignment whenever the query is not
  // itself in the target database, so the query row is derived from #=GC RF.
  // Here the query IS in swissprot, which means its own aligned row is present
  // to check the derivation against.
  test('derives a query row identical to the one phmmer emitted for it', () => {
    const { rows, queryRow } = parsePhmmerAlignment({ stockholm, query })

    expect(queryRow).toBe(rows[0]!.aligned)
  })

  test('refuses to place a query the match columns do not account for', () => {
    expect(() =>
      parsePhmmerAlignment({ stockholm, query: query.slice(0, 100) }),
    ).toThrow(/match columns for a query of 100 residues/)
  })

  test('throws when there is no RF line to place the query by', () => {
    expect(() =>
      parsePhmmerAlignment({
        stockholm: stockholm
          .split('\n')
          .filter(l => !l.startsWith('#=GC RF'))
          .join('\n'),
        query,
      }),
    ).toThrow(/no #=GC RF line/)
  })
})

describe('phmmer job ids', () => {
  test('links a phmmer job to the category jdispatcher actually serves', () => {
    // jdispatcher answers every category with its shell and a 200, so /pfa/ and
    // /psa/ pass a url check and render "Page Not Found"
    expect(phmmerResultUrl('hmmer3_phmmer-R1-p1m')).toBe(
      'https://www.ebi.ac.uk/jdispatcher/sss/hmmer3_phmmer/summary?jobId=hmmer3_phmmer-R1-p1m',
    )
  })

  test('tells phmmer and ncbiblast jobs apart', () => {
    expect(isPhmmerJobId('hmmer3_phmmer-R1-p1m')).toBe(true)
    expect(isPhmmerJobId('ncbiblast-R1-p2m')).toBe(false)
  })
})
