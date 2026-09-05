import { describe, expect, test } from 'vitest'

import { buildSearchMsa } from '../src/utils/msaRows'
import { queryPhmmer, toSearchHits } from '../src/utils/phmmer'

// Hits the real EBI Job Dispatcher, so it is opt-in: LIVE=1 vitest run
// test/phmmerLive.test.ts. A unit test against a captured .sto cannot notice
// when HMMER's annotations, EBI's status vocabulary or the result urls change,
// and it cannot check the one thing the view actually depends on: that the MSA,
// the tree and the metadata all agree about what the rows are called.
const live = process.env.LIVE ? describe : describe.skip

// human albumin, whose swissprot hits include its own paralogs (alpha-
// fetoprotein, afamin, vitamin D-binding protein) and lamprey albumin, which
// matches this three-domain protein in several places at once
const ALBUMIN =
  'MKWVTFISLLFLFSSAYSRGVFRRDAHKSEVAHRFKDLGEENFKALVLIAFAQYLQQCPFEDHVKLVNEVTEFAKTCVADESAENCDKSLHTLFGDKLCTVATLRETYGEMADCCAKQEPERNECFLQHKDDNPNLPRLVRPEVDVMCTAFHDNEETFLKKYLYEIARRHPYFYAPELLFFAKRYKAAFTECCQAADKAACLLPKLDELRDEGKASSAKQRLKCASLQKFGERAFKAWAVARLSQRFPKAEFAEVSKLVTDLTKVHTECCHGDLLECADDRADLAKYICENQDSISSKLKECCEKPLLEKSHCIAEVENDEMPADLPSLAADFVESKDVCKNYAEAKDVFLGMFLYEYARRHPDYSVVLLLRLAKTYETTLEKCCAAADPHECYAKVFDEFKPLVEEPQNLIKQNCELFEQLGEYKFQNALLVRYTKKVPQVSTPTLVEVSRNLGKVGSKCCKHPEAKRMPCAEDYLSVVLNQLCVLHEKTPVSDRVTKCCTESLVNRRPCFSALEVDETYVPKEFNAETFTFHADICTLSEKERQIKKQTALVELVKHKPKATKEQLKAVMDDFAAFVEKCCKADDKETCFAEEGKKLVAASQAALGL'

live('EBI phmmer, live', () => {
  test(
    'produces an MSA, a tree and metadata that agree about the rows',
    async () => {
      const progress: string[] = []
      const { rid, rows, queryRow } = await queryPhmmer({
        query: ALBUMIN,
        database: 'swissprot',
        onProgress: s => progress.push(s),
        onRid: () => {},
      })

      expect(rid).toMatch(/^hmmer3_phmmer-/)
      expect(rows.length).toBeGreaterThan(0)

      const first = rows[0]!
      expect(first.accession).toBeTruthy()
      expect(first.sciname).not.toBe('unknown')
      expect(typeof first.taxid).toBe('number')

      // the query is in swissprot, so phmmer emits its own row for it and the
      // derivation has something to be checked against
      expect(queryRow).toBe(first.aligned)

      // no taxonomy lookup: it caches through IndexedDB, which node has not
      // got, and it is the same call the BLAST path already makes. Without it
      // rows are named by scientific name instead of common name, which
      // exercises the same naming and de-duplication path.
      const { msa, treeMetadata } = buildSearchMsa({
        hits: toSearchHits(rows),
        query: ALBUMIN,
        queryRow,
        taxonomyInfo: new Map(),
      })

      const entries = msa
        .split('>')
        .filter(Boolean)
        .map(block => {
          const [name, ...seq] = block.split('\n')
          return { name: name!, seq: seq.join('') }
        })

      // a duplicate name silently collapses rows in both the MSA and the tree
      expect(new Set(entries.map(e => e.name)).size).toBe(entries.length)
      expect(entries.length).toBe(rows.length + 1)
      expect(new Set(entries.map(e => e.seq.length)).size).toBe(1)
      expect(entries[0]!.name).toBe('QUERY')
      expect(entries[0]!.seq.replaceAll('-', '')).toBe(ALBUMIN)

      // every row the view can click on has metadata, keyed the same way
      expect(Object.keys(treeMetadata).toSorted()).toEqual(
        entries
          .slice(1)
          .map(e => e.name)
          .toSorted(),
      )

      expect(progress.length).toBeGreaterThan(0)
    },
    15 * 60 * 1000,
  )
})
