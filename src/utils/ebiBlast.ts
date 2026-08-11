import { fetchEbiResult, submitEbiJob, waitForEbiJob } from './ebiJobDispatcher'

import type { BlastHit } from './types'
import type { BlastDatabase } from '../LaunchMsaView/components/BlastQuery/consts'

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
}: {
  jobId: string
  onProgress: (arg: string) => void
}) {
  onProgress(`Checking BLAST status for job: ${jobId}...`)
  await waitForEbiJob({
    tool: TOOL,
    jobId,
    onCountdown: s => {
      onProgress(`Re-checking BLAST status in... ${s}`)
    },
  })

  const hits = normalizeEbiBlastHits(
    JSON.parse(
      await fetchEbiResult({ tool: TOOL, jobId, type: 'json' }),
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
  onProgress,
  onRid,
}: {
  query: string
  blastDatabase: BlastDatabase
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
}) {
  onProgress('Submitting to EBI BLAST...')
  const jobId = await submitEbiJob({
    tool: TOOL,
    params: {
      program: 'blastp',
      stype: 'protein',
      database: blastDatabase,
      sequence: query,
    },
  })
  onRid(jobId)
  return queryEbiBlastFromJobId({ jobId, onProgress })
}
