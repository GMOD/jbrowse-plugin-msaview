import { StockholmMSA } from 'msa-parsers'

import { fetchEbiResult, submitEbiJob, waitForEbiJob } from './ebiJobDispatcher'

import type { PhmmerDatabase } from '../LaunchMsaView/components/BlastQuery/consts'

const TOOL = 'hmmer3_phmmer'

export interface PhmmerRow {
  accession: string
  id: string
  sciname: string
  taxid?: number
  title?: string
  /** the matched envelope on the target, e.g. '503-912', absent if unparseable */
  range?: string
  /** the row as phmmer aligned it, uppercased with '.' inserts turned into '-' */
  aligned: string
}

export interface PhmmerAlignment {
  rows: PhmmerRow[]
  /**
   * the query, placed into the same columns. phmmer does not put the query in
   * its own output, so this is derived — see buildQueryRow.
   */
  queryRow: string
}

/**
 * Human-facing link to a job, shown while it runs and on error.
 *
 * The category has to be sss: jdispatcher serves its shell with a 200 for any
 * category, so /pfa/ and /psa/ look fine to a fetch and render "Page Not Found"
 * in a browser.
 */
export function phmmerResultUrl(jobId: string) {
  return `https://www.ebi.ac.uk/jdispatcher/sss/${TOOL}/summary?jobId=${jobId}`
}

/** EBI job ids are prefixed with the tool that made them */
export function isPhmmerJobId(jobId: string) {
  return jobId.startsWith(`${TOOL}-`)
}

/**
 * phmmer aligns every hit to a profile built from the query, one match state
 * per query residue, and marks those columns 'x' in #=GC RF. So the query's own
 * row is exactly recoverable: walk RF, consume a query residue at each match
 * column, gap everywhere else.
 *
 * This is the one piece of real logic here rather than a library call, and it
 * is checked hard: if the match columns do not account for the query exactly,
 * the columns and the query have drifted apart, and a query row that is off by
 * even one residue would silently mis-map every column to the genome. Throwing
 * is much better than drawing that.
 */
function buildQueryRow({ rf, query }: { rf: string; query: string }) {
  let consumed = 0
  const row = Array.from(rf, c =>
    c === 'x' ? (query[consumed++] ?? '-') : '-',
  ).join('')
  if (consumed !== query.length) {
    throw new Error(
      `phmmer alignment has ${consumed} match columns for a query of ${query.length} residues, so the query row cannot be placed`,
    )
  }
  return row
}

/**
 * '[subseq from] Albumin OS=Homo sapiens OX=9606 GN=ALB PE=1 SV=2' is what a
 * UniProt target's #=GS DE looks like. Hits from the non-UniProt databases
 * phmmer also offers (PDB, AlphaFold, MEROPS...) carry no OS=/OX= at all, so
 * every field here is optional.
 */
function parseDescription(de: string | undefined) {
  const text = (de ?? '').replace('[subseq from] ', '')
  const sciname = /OS=(.*?)\s+(?:OX|GN|PE|SV)=/.exec(text)?.[1]
  const ox = /OX=(\d+)/.exec(text)?.[1]
  return {
    sciname: sciname ?? 'unknown',
    taxid: ox ? Number.parseInt(ox, 10) : undefined,
    title: text.split(' OS=')[0] || undefined,
  }
}

/**
 * Target names look like 'sp|P02768|ALBU_HUMAN/1-609' for UniProt databases and
 * like anything at all for the others, so an unrecognized name becomes its own
 * accession rather than being dropped.
 */
function parseName(name: string) {
  const slash = name.lastIndexOf('/')
  const range =
    slash === -1 ? undefined : /^\d+-\d+$/.exec(name.slice(slash + 1))?.[0]
  const bare = range === undefined ? name : name.slice(0, slash)
  const parts = bare.split('|')
  return parts.length === 3
    ? { accession: parts[1]!, id: parts[2]!, range }
    : { accession: bare, id: bare, range }
}

/**
 * Exported for testing against a captured .sto — the annotation names (RF, the
 * DE line's OS=/OX=) are the whole risk in this mapping, and nothing else in CI
 * would notice if HMMER or EBI changed one.
 */
export function parsePhmmerAlignment({
  stockholm,
  query,
}: {
  stockholm: string
  query: string
}): PhmmerAlignment {
  const { gc, gs, seqdata, seqname } = new StockholmMSA(stockholm, 0).getMSA()
  const rf = gc.RF
  if (!rf) {
    throw new Error('phmmer alignment has no #=GC RF line')
  }

  return {
    queryRow: buildQueryRow({ rf, query }),
    rows: seqname.map(name => ({
      ...parseName(name),
      ...parseDescription(gs.DE?.[name]?.[0]),
      // insert columns come back lowercase with '.' for gaps; the MSA renderer
      // looks colors up by the literal letter, so lowercase would draw
      // uncolored. The insert columns stay visible as gaps in the query row.
      aligned: (seqdata[name] ?? '').replaceAll('.', '-').toUpperCase(),
    })),
  }
}

export async function queryPhmmer({
  query,
  database,
  onProgress,
  onRid,
}: {
  query: string
  database: PhmmerDatabase
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
}) {
  onProgress('Submitting to EBI phmmer...')
  const jobId = await submitEbiJob({
    tool: TOOL,
    params: {
      database,
      sequence: query,
      // the alignment is the whole point of using phmmer here
      alignView: 'true',
    },
  })
  onRid(jobId)

  await waitForEbiJob({
    tool: TOOL,
    jobId,
    onCountdown: s => {
      onProgress(`Re-checking phmmer status in... ${s}`)
    },
  })

  const alignment = parsePhmmerAlignment({
    stockholm: await fetchEbiResult({ tool: TOOL, jobId, type: 'sto' }),
    query,
  })
  if (alignment.rows.length === 0) {
    throw new Error('No hits found')
  }
  return { rid: jobId, ...alignment }
}
