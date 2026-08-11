import { describe, expect, test } from 'vitest'

import { queryEbiBlast } from '../src/utils/ebiBlast'
import { launchMSA } from '../src/utils/msa'

// Hits the real EBI Job Dispatcher, so it is opt-in: LIVE=1 vitest run
// test/ebiBlastLive.test.ts. This is the only check that the field names, the
// status vocabulary and the run/status/result urls are all still right — a unit
// test against a captured response cannot notice when EBI changes any of them.
const live = process.env.LIVE ? describe : describe.skip

live('EBI BLAST, live', () => {
  test(
    'runs a search and feeds the hits into an alignment',
    async () => {
      const progress: string[] = []
      const { rid, hits } = await queryEbiBlast({
        query:
          'MKWVTFISLLLLFSSAYSRGVFRRDTHKSEIAHRFKDLGEEHFKGLVLIAFSQYLQQCPFDEHVKLVNELTEFAK',
        blastDatabase: 'uniprotkb_swissprot',
        onProgress: s => progress.push(s),
        onRid: () => {},
      })

      expect(rid).toMatch(/^ncbiblast-/)
      expect(hits.length).toBeGreaterThan(0)

      const [first] = hits
      expect(first!.description[0]!.accession).toBeTruthy()
      expect(first!.description[0]!.sciname).not.toBe('unknown')
      expect(typeof first!.description[0]!.taxid).toBe('number')
      expect(first!.hsps[0]!.hseq).toMatch(/^[A-Z-]+$/)

      // the MSA step is the other half of the pipeline and shares the transport
      const { msa, tree } = await launchMSA({
        algorithm: 'clustalo',
        sequence: hits
          .slice(0, 5)
          .map(
            (h, i) =>
              `>${h.description[0]!.accession}_${i}\n${h.hsps[0]!.hseq.replaceAll('-', '')}`,
          )
          .join('\n'),
        onProgress: s => progress.push(s),
      })
      expect(msa).toContain('CLUSTAL')
      expect(tree).toContain(';')
    },
    10 * 60 * 1000,
  )
})
