import { jsonfetch, textfetch } from './fetch'
import { pollLoop } from './poll'

import type { BlastResults } from './types'
import type {
  BlastDatabase,
  BlastProgram,
} from '../LaunchMsaView/components/NCBIBlastQuery/consts'

export async function queryBlastFromRid({
  rid,
  baseUrl,
  onProgress,
}: {
  rid: string
  baseUrl: string
  onProgress: (arg: string) => void
}) {
  onProgress(`Checking BLAST status for RID: ${rid}...`)
  await waitForRid({
    rid,
    onProgress,
    baseUrl,
  })
  const ret = await jsonfetch<BlastResults>(
    `${baseUrl}?CMD=Get&RID=${rid}&FORMAT_TYPE=JSON2_S&FORMAT_OBJECT=Alignment`,
  )
  return {
    rid,
    hits: ret.BlastOutput2[0]?.report.results.search.hits ?? [],
  }
}

export async function queryBlast({
  query,
  blastDatabase,
  blastProgram,
  baseUrl,
  onProgress,
  onRid,
}: {
  query: string
  blastDatabase: BlastDatabase
  blastProgram: BlastProgram
  baseUrl: string
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
}) {
  onProgress('Submitting to NCBI BLAST...')
  const { rid } = await initialQuery({
    query,
    blastDatabase,
    blastProgram,
    baseUrl,
  })
  onRid(rid)
  return queryBlastFromRid({ rid, baseUrl, onProgress })
}

async function initialQuery({
  query,
  blastProgram,
  blastDatabase,
  baseUrl,
}: {
  query: string
  blastProgram: BlastProgram
  blastDatabase: BlastDatabase
  baseUrl: string
}) {
  const res = await textfetch(baseUrl, {
    method: 'POST',
    body: new URLSearchParams({
      CMD: 'Put',
      PROGRAM: blastProgram === 'quick-blastp' ? 'blastp' : blastProgram,
      DATABASE: blastDatabase,
      QUERY: query,
      ...(blastDatabase === 'nr_cluster_seq'
        ? {
            CLUSTERED_DB: 'on',
            DB_TYPE: 'Experimental Databases',
          }
        : {}),
      ...(blastProgram === 'quick-blastp'
        ? { BLAST_PROGRAMS: 'kmerBlastp' }
        : {}),
    }),
  })

  // the initial submission/query to the BLAST "REST API" does not return JSON
  // as a response (e.g. FORMAT_TYPE=JSON does not work), so the RID is
  // literally parsed from the text of the HTML that is returned
  const rid = /^ {4}RID = (.*$)/m.exec(res)?.[1]
  const rtoe = /^ {4}RTOE = (.*$)/m.exec(res)?.[1]

  if (!rid) {
    throw new Error('Failed to get RID from BLAST request')
  }
  return {
    rid,
    rtoe,
  }
}

async function waitForRid({
  rid,
  onProgress,
  baseUrl,
}: {
  rid: string
  onProgress: (arg: string) => void
  baseUrl: string
}) {
  await pollLoop({
    intervalSeconds: 20,
    onCountdown: s => {
      onProgress(`Re-checking BLAST status in... ${s}`)
    },
    check: async () => {
      const res = await textfetch(
        `${baseUrl}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`,
      )
      const status = /\s+Status=(\S+)/m.exec(res)?.[1]
      const hasHits = /\s+ThereAreHits=yes/m.test(res)

      if (status === 'WAITING') {
        return false
      }
      if (status === 'FAILED') {
        throw new Error(`BLAST ${rid} failed`)
      }
      if (status === 'READY') {
        if (hasHits) {
          return true
        }
        throw new Error('No hits found')
      }
      throw new Error(
        `BLAST ${rid} returned unexpected status: ${status ?? 'unknown'}`,
      )
    },
  })
}
