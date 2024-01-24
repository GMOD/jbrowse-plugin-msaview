import { jsonfetch, textfetch, timeout } from './util'
import { launchMSA } from './clustalOmega'

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
  // const { rid, rtoe } = await initialQuery({ query, database, program })
  // console.log({ rid, rtoe })
  // onRid(rid)
  // await waitForRid({ rid, onProgress })
  const rid = 'UZYB5KJA013'
  const ret = await jsonfetch(
    `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=JSON2_S&FORMAT_OBJECT=Alignment`,
  )
  const hits = ret.BlastOutput2[0].report.results.search.hits as {
    description: { accession: string; id: string; sciname: string }[]
    hsps: { hseq: string }[]
  }[]
  console.log({ hits })
  const results = hits.map(
    h =>
      [
        h.description[0].accession +
          '-' +
          h.description[0].sciname.replaceAll(' ', '_'),
        h.hsps[0].hseq.replaceAll('-', ''),
      ] as const,
  )
  const fasta = results.map(([id, seq]) => `>${id}\n${seq}`).join('\n')
  return launchMSA({ sequence: fasta, onProgress })
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
  const url = `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi`
  const res = await textfetch(url, {
    method: 'POST',
    body: new URLSearchParams({
      CMD: 'Put',
      PROGRAM: program,
      DATABASE: database,
      QUERY: query,
      CLUSTERED_DB: 'on',
      DB_TYPE: 'Experimental Databases',
    }),
  })
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
    for (let i = 0; i < 10; i++) {
      await timeout(1000)
      onProgress(`Re-checking BLAST status in... ${10 - i}`)
    }

    const res = await textfetch(
      `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`,
    )
    if (res.match(/\s+Status=WAITING/m)) {
      continue
    } else if (res.match(/\s+Status=FAILED/m)) {
      throw new Error(
        `Search ${rid} failed; please report to blast-help@ncbi.nlm.nih.gov`,
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
