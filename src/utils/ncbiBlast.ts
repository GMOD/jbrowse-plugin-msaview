import { jsonfetch, textfetch, timeout } from './fetch'
import { BlastResults } from './types'

export async function queryBlast({
  query,
  blastDatabase,
  blastProgram,
  baseUrl,
  onProgress,
  onRid,
}: {
  query: string
  blastDatabase: string
  blastProgram: string
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

async function initialQuery({
  query,
  blastProgram,
  blastDatabase,
  baseUrl,
}: {
  query: string
  blastProgram: string
  blastDatabase: string
  baseUrl: string
}) {
  const res = await textfetch(baseUrl, {
    method: 'POST',
    body: new URLSearchParams({
      CMD: 'Put',
      PROGRAM: blastProgram === 'quick-blastp' ? 'blastp' : blastProgram,
      DATABASE: blastDatabase,
      QUERY: query,
      ...(blastDatabase === 'nr_clustered_seq'
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const iter = 20
    for (let i = 0; i < iter; i++) {
      await timeout(1000)
      onProgress(`Re-checking BLAST status in... ${iter - i}`)
    }

    const res = await textfetch(
      `${baseUrl}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`,
    )
    const isWaiting = /\s+Status=WAITING/m.test(res)
    const isFailed = /\s+Status=FAILED/m.test(res)
    const isReady = /\s+Status=READY/m.test(res)
    const hasHits = /\s+ThereAreHits=yes/m.test(res)

    if (isWaiting) {
      continue
    }

    if (isFailed) {
      throw new Error(`BLAST ${rid} failed`)
    }

    if (isReady) {
      if (hasHits) {
        return true
      } else {
        throw new Error('No hits found')
      }
    }
  }
}
