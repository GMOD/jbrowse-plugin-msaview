import { snapBlastHitCount } from '../LaunchMsaView/components/BlastQuery/consts'
import { strip } from '../LaunchMsaView/components/util'
import { fetchEbiResult, submitEbiJob, waitForEbiJob } from './ebiJobDispatcher'

import type { BlastDatabase } from '../LaunchMsaView/components/BlastQuery/consts'
import type { SearchBackend } from './homologSearch'
import type { BlastHit } from './types'

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
 * Map EBI's hit shape onto the normalized one. Exported for testing against a
 * captured response — the field names are the whole risk here, and nothing else
 * in CI would notice if EBI renamed one.
 */
export function normalizeEbiBlastHits(result: EbiBlastJson): BlastHit[] {
  return (result.hits ?? []).map(hit => {
    const taxid = Number.parseInt(hit.hit_uni_ox ?? '', 10)
    return {
      description: [
        {
          accession: hit.hit_acc ?? 'unknown',
          id: hit.hit_id ?? hit.hit_acc ?? 'unknown',
          sciname: hit.hit_uni_os ?? hit.hit_os ?? 'unknown',
          taxid: Number.isNaN(taxid) ? undefined : taxid,
          // hit_uni_de is the bare protein name; hit_desc repeats it with the
          // OS=/OX=/GN= suffix that makeId already covers with real columns
          title: hit.hit_uni_de ?? hit.hit_desc,
        },
      ],
      hsps: (hit.hit_hsps ?? []).flatMap(hsp =>
        hsp.hsp_hseq ? [{ hseq: hsp.hsp_hseq }] : [],
      ),
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

export async function queryEbiBlastFromJobId({
  jobId,
  onProgress,
  signal,
}: {
  jobId: string
  onProgress: (arg: string) => void
  signal?: AbortSignal
}) {
  onProgress(`Checking BLAST status for job: ${jobId}...`)
  await waitForEbiJob({
    tool: TOOL,
    jobId,
    signal,
    onCountdown: s => {
      onProgress(`Re-checking BLAST status in... ${s}`)
    },
  })

  const hits = normalizeEbiBlastHits(
    JSON.parse(
      await fetchEbiResult({ tool: TOOL, jobId, type: 'json', signal }),
    ) as EbiBlastJson,
  )
  if (hits.length === 0) {
    throw new Error('No hits found')
  }
  return { rid: jobId, hits }
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
  /** rounded up to a count EBI accepts; their default of 50 when omitted */
  maxHits?: number
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
  signal?: AbortSignal
}) {
  onProgress('Submitting to EBI BLAST...')
  const hitCount = maxHits ? String(snapBlastHitCount(maxHits)) : undefined
  const jobId = await submitEbiJob({
    tool: TOOL,
    params: {
      program: 'blastp',
      stype: 'protein',
      database: blastDatabase,
      sequence: query,
      ...(hitCount ? { alignments: hitCount, scores: hitCount } : {}),
    },
    signal,
  })
  onRid(jobId)
  return queryEbiBlastFromJobId({ jobId, onProgress, signal })
}

/**
 * BLAST as a search backend. Its alignments are pairwise and one hit at a
 * time, so they are stripped back off and the hits go to an aligner as bare
 * sequences: no `queryRow`.
 */
export const searchEbiBlast: SearchBackend = async ({
  database,
  ...request
}) => {
  const { hits, rid } = await queryEbiBlast({
    blastDatabase: database as BlastDatabase,
    ...request,
  })
  return {
    rid,
    hits: hits.map(hit => ({
      ...(hit.description[0] ?? {
        accession: 'unknown',
        id: 'unknown',
        sciname: 'unknown',
      }),
      sequence: strip(hit.hsps[0]?.hseq ?? ''),
    })),
  }
}
