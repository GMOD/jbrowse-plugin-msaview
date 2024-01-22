import { myfetch, timeout } from './util'
import { data } from './testFile'

export async function queryBlast({
  querySequence,
  database,
  program,
  onCountdown,
  onRid,
}: {
  querySequence: string
  database: string
  program: string
  onCountdown: (arg: number) => void
  onRid: (arg: string) => void
}) {
  // const url = `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi`
  // const data = new URLSearchParams({
  //   CMD: 'Put',
  //   PROGRAM: program,
  //   DATABASE: database,
  //   QUERY: querySequence,
  // })

  // const res = await myfetch(url, { method: 'POST', body: data })
  // const rid = res.match(/^    RID = (.*$)/m)?.[1]
  // const rtoe = res.match(/^    RTOE = (.*$)/m)?.[1]

  // if (rid) {
  //   console.log({ rid, rtoe })
  //   onRid(rid)
  //   while (rid) {
  //     for (let i = 0; i < 10; i++) {
  //       await timeout(1000)
  //       onCountdown(10 - i)
  //     }

  //     const res = await myfetch(
  //       `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${rid}`,
  //     )
  //     if (res.match(/\s+Status=WAITING/m)) {
  //       continue
  //     } else if (res.match(/\s+Status=FAILED/m)) {
  //       throw new Error(
  //         `Search ${rid} failed; please report to blast-help@ncbi.nlm.nih.gov`,
  //       )
  //     } else if (res.match(/\s+Status=READY/m)) {
  //       if (res.match(/\s+ThereAreHits=yes/m)) {
  //         break
  //       } else {
  //         throw new Error('No hits found')
  //       }
  //     }
  //   }
  //   const final = await myfetch(
  //     `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=XML`,
  //   )

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(data, 'text/xml')

  // Access elements and extract data
  const query = xmlDoc.querySelector('BlastOutput_query-def')?.textContent
  const hits = [...xmlDoc.querySelectorAll('Hit')].map(h => {
    const hitSeq = h.querySelector('Hsp_hseq')?.textContent
    const eValue = h.querySelector('Hsp_evalue')?.textContent
    return { hitSeq, eValue }
  })
  console.log({ hits, query })
}
