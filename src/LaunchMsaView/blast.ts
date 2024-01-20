import { myfetch, timeout } from './util'

export async function queryBlast({
  querySequence,
  database,
  program,
  onUpdate,
}: {
  querySequence: string
  database: string
  program: string
  onUpdate: (arg: Date) => void
}) {
  const url = `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi`
  const data = new URLSearchParams({
    CMD: 'Put',
    PROGRAM: program,
    DATABASE: database,
    QUERY: querySequence,
  })

  const res = await myfetch(url, { method: 'POST', body: data })
  const rid = res.match(/^    RID = (.*$)/m)?.[1]
  const rtoe = res.match(/^    RTOE = (.*$)/m)?.[1]
  while (rid) {
    onUpdate(new Date())
    await timeout(5000)

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
        break
      } else {
        throw new Error('No hits found')
      }
    }
  }
  const final = await myfetch(
    `https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi?CMD=Get&RID=${rid}&FORMAT_TYPE=XML`,
  )

  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(final, 'text/xml')

  // Access elements and extract data
  const query = xmlDoc.querySelector('BlastOutput_query-def')?.textContent
  const hits = xmlDoc.querySelectorAll('Hit')

  console.log({ query })
  hits.forEach(h => {
    const hit = h.querySelector('Hit_def')?.textContent
    const eValue = h.querySelector('Hsp_evalue')?.textContent
    console.log({ hit, eValue })
  })

  return { rid, rtoe }
}
