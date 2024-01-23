import { myfetch, timeout } from './util'
import { data } from './testFile'

export async function queryBlast({
  query,
  database,
  program,
  onCountdown,
  onRid,
}: {
  query: string
  database: string
  program: string
  onCountdown: (arg: number) => void
  onRid: (arg: string) => void
}) {
  // const { rid, rtoe } = await initialQuery({ query, database, program })
  // console.log({ rid, rtoe })
  // onRid(rid)
  // await waitForRid({ rid, onCountdown })
  const rid = 'UZYB5KJA013'
  const final = await myfetch(
    `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=JSON2_S&FORMAT_OBJECT=Alignment`,
  )
  const ret = JSON.parse(final)
  console.log({ ret })
  const hits = ret.BlastOutput2[0].report.results.search.hits as {
    description: { id: string }[]
    hsps: { hseq: string }[]
  }[]
  const results = hits.map(h => [h.description[0].id, h.hsps[0].hseq] as const)
  console.log({
    ret,
    hits_text: results.map(([id, seq]) => `>${id}\n${seq}`).join('\n'),
    hits,
  })

  //   const parser = new DOMParser()
  //   const xmlDoc = parser.parseFromString(final, 'text/xml')

  //   // Access elements and extract data
  //   const query = xmlDoc.querySelector('BlastOutput_query-def')?.textContent
  //   const hits = [...xmlDoc.querySelectorAll('Hit')].map(h => {
  //     const hitSeq = h.querySelector('Hsp_hseq')?.textContent
  //     const eValue = h.querySelector('Hsp_evalue')?.textContent
  //     return { hitSeq, eValue }
  //   })
  //   console.log({ hits, query })
  return { hello: 'world' }
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
  const data = new URLSearchParams({
    CMD: 'Put',
    PROGRAM: program,
    DATABASE: database,
    QUERY: query,
    CLUSTERED_DB: 'on',
    DB_TYPE: 'Experimental Databases',
  })

  const res = await myfetch(url, { method: 'POST', body: data })
  const rid = res.match(/^    RID = (.*$)/m)?.[1]
  const rtoe = res.match(/^    RTOE = (.*$)/m)?.[1]

  if (!rid) {
    throw new Error('Failed to get RID from BLAST request')
  }
  return { rid, rtoe }
}

async function waitForRid({
  rid,
  onCountdown,
}: {
  rid: string
  onCountdown: (arg: number) => void
}) {
  while (true) {
    for (let i = 0; i < 10; i++) {
      await timeout(1000)
      onCountdown(10 - i)
    }

    const res = await myfetch(
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
