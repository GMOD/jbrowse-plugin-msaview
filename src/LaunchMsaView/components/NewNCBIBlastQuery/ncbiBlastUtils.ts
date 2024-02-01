import { jsonfetch, textfetch, timeout } from '../../fetchUtils'

export const BLAST_URL = `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi`

export async function queryBlast({
  query,
  database,
  program,
  onProgress,
  onRid,
}: {
  query: string
  database: string
  program: string
  onProgress: (arg: string) => void
  onRid: (arg: string) => void
}) {
  onProgress('Submitting to NCBI BLAST...')
  const { rid } = await initialQuery({
    query,
    database,
    program,
  })
  onRid(rid)
  await waitForRid({ rid, onProgress })
  console.log({ rid })
  const ret = await jsonfetch(
    `${BLAST_URL}?CMD=Get&RID=${rid}&FORMAT_TYPE=JSON2_S&FORMAT_OBJECT=Alignment`,
  )
  const hits = ret.BlastOutput2[0].report.results.search.hits as {
    description: { accession: string; id: string; sciname: string }[]
    hsps: { hseq: string }[]
  }[]

  return { rid, hits }
}

async function initialQuery({
  query,
  program,
  database,
}: {
  query: string
  program: string
  database: string
}) {
  const res = await textfetch(BLAST_URL, {
    method: 'POST',
    body: new URLSearchParams({
      CMD: 'Put',
      PROGRAM: program,
      DATABASE: database,
      QUERY: query,
      ...(database === 'nr_clustered_seq'
        ? {
            CLUSTERED_DB: 'on',
            DB_TYPE: 'Experimental Databases',
          }
        : {}),
    }),
  })

  // the initial submission/query to the BLAST "REST API" does not return JSON
  // as a response (e.g. FORMAT_TYPE=JSON does not work), so the RID is
  // literally parsed from the text of the HTML that is returned
  const rid = res.match(/^    RID = (.*$)/m)?.[1]
  const rtoe = res.match(/^    RTOE = (.*$)/m)?.[1]

  if (!rid) {
    throw new Error('Failed to get RID from BLAST request')
  }
  return { rid, rtoe }
}

async function waitForRid({
  rid,
  onProgress,
}: {
  rid: string
  onProgress: (arg: string) => void
}) {
  while (true) {
    const iter = 20
    for (let i = 0; i < iter; i++) {
      await timeout(1000)
      onProgress(`Re-checking BLAST status in... ${iter - i}`)
    }

    const res = await textfetch(
      `${BLAST_URL}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`,
    )
    if (res.match(/\s+Status=WAITING/m)) {
      continue
    } else if (res.match(/\s+Status=FAILED/m)) {
      throw new Error(
        `BLAST ${rid} failed; please report to blast-help@ncbi.nlm.nih.gov`,
      )
    } else if (res.match(/\s+Status=READY/m)) {
      if (res.match(/\s+ThereAreHits=yes/m)) {
        return true
      } else {
        throw new Error('No hits found')
      }
    }
  }
}
