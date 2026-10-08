import {
  defaultMaxHits,
  snapBlastHitCount,
} from '../LaunchMsaView/components/BlastQuery/consts'
import { runEbiJob } from './ebiJobDispatcher'

import type { BlastDatabase } from '../LaunchMsaView/components/BlastQuery/consts'
import type { SearchBackend, SearchHit } from './homologSearch'

const TOOL = 'ncbiblast'

/**
 * The subset of EBI's ncbiblast JSON result this plugin reads. The service
 * returns a great deal more per hit (urls, bit scores, e-values, the match
 * string); only what the MSA rows are built from is typed here.
 */
interface EbiBlastJson {
  hits?: {
    hit_acc?: string
    hit_id?: string
    hit_desc?: string
    /** the UniProt fields are absent on hits from non-UniProt databases */
    hit_os?: string
    hit_uni_de?: string
    hit_uni_os?: string
    /** NCBI taxon id, delivered as a string */
    hit_uni_ox?: string
    hit_hsps?: { hsp_hseq?: string }[]
  }[]
}

/**
 * EBI's hits as search hits. BLAST's alignments are pairwise, one hit at a
 * time, so the gaps come back off and an aligner gets bare sequences. Exported
 * for testing against a captured response: nothing else in CI would notice if
 * EBI renamed a field.
 */
export function normalizeEbiBlastHits(result: EbiBlastJson): SearchHit[] {
  return (result.hits ?? []).map(hit => {
    const taxid = Number.parseInt(hit.hit_uni_ox ?? '', 10)
    return {
      accession: hit.hit_acc ?? 'unknown',
      id: hit.hit_id ?? hit.hit_acc ?? 'unknown',
      sciname: hit.hit_uni_os ?? hit.hit_os ?? 'unknown',
      taxid: Number.isNaN(taxid) ? undefined : taxid,
      // hit_uni_de is the bare protein name; hit_desc repeats it with the
      // OS=/OX=/GN= suffix that makeId already covers with real columns
      title: hit.hit_uni_de ?? hit.hit_desc,
      sequence: (hit.hit_hsps?.[0]?.hsp_hseq ?? '').replaceAll('-', ''),
    }
  })
}

/**
 * Human-facing link to a job, shown while it runs and on error — so it has to
 * be EBI's own results UI, not the REST result endpoint, which does not exist
 * yet at the moment the link is on screen.
 */
export function ebiBlastResultUrl(jobId: string) {
  return `https://www.ebi.ac.uk/jdispatcher/sss/${TOOL}/summary?jobId=${jobId}`
}

export async function queryEbiBlast({
  query,
  blastDatabase,
  maxHits,
  onProgress,
  onRid,
  signal,
}: {
  query: string
  blastDatabase: BlastDatabase
  /** rounded up to a count EBI accepts */
  maxHits?: number
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
  signal?: AbortSignal
}) {
  const hitCount = String(snapBlastHitCount(maxHits ?? defaultMaxHits))
  const job = await runEbiJob({
    tool: TOOL,
    label: 'BLAST',
    params: {
      program: 'blastp',
      stype: 'protein',
      database: blastDatabase,
      sequence: query,
      alignments: hitCount,
      scores: hitCount,
    },
    onProgress,
    onRid,
    signal,
  })
  return {
    rid: job.jobId,
    hits: normalizeEbiBlastHits(
      JSON.parse(await job.result('json')) as EbiBlastJson,
    ),
  }
}

export const searchEbiBlast: SearchBackend = ({ database, ...request }) =>
  queryEbiBlast({ blastDatabase: database as BlastDatabase, ...request })
