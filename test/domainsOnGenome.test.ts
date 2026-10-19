import path from 'node:path'
import { deflateSync } from 'node:zlib'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  JBROWSE_PORT,
  createJBrowsePage,
  launchBrowser,
  saveScreenshot,
  setupJBrowse,
  startJBrowseServer,
  stopServer,
} from './setup'

import type { ChildProcess } from 'node:child_process'
import type { Browser, Page } from 'puppeteer'

// Opt-in (SCREENSHOT_DOMAINS=1), since the domains come from a live NCBI
// efetch: HBB orthologs beside the genome, launched with domainsOnGenome, so
// the view adds the CDD domains to the genome view once they load.
const run = process.env.SCREENSHOT_DOMAINS ? describe : describe.skip

const ROWS = {
  Human: 'NP_000509.1',
  Mouse: 'NP_058652.1',
  Chicken: 'NP_990820.1',
}
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots')
const TRACK_ID = 'msaview-domains-msa1'

// GENCODE v44 ENST00000335295.4, HBB on the reverse strand of chr11
const hbb = {
  uniqueId: 'ENST00000335295.4',
  type: 'mRNA',
  refName: 'chr11',
  start: 5225597,
  end: 5227021,
  strand: -1,
  name: 'HBB-201',
  gene_name: 'HBB',
  subfeatures: [
    { type: 'CDS', start: 5225597, end: 5225726, strand: -1, phase: 0 },
    { type: 'CDS', start: 5226576, end: 5226799, strand: -1, phase: 1 },
    { type: 'CDS', start: 5226929, end: 5227021, strand: -1, phase: 0 },
  ],
}

async function fetchFasta(accession: string) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=${accession}&rettype=fasta&retmode=text&tool=jbrowse-plugin-msaview&email=jbrowse2@berkeley.edu`
  const text = await (await fetch(url)).text()
  return text.split('\n').slice(1).join('').replace(/\s/g, '')
}

function sessionUrl(session: unknown) {
  const encoded = deflateSync(JSON.stringify(session))
    .toString('base64')
    .replace(/=+$/, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
  return `http://localhost:${JBROWSE_PORT}/#config=config.json&session=encoded-${encoded}`
}

interface SessionHandle {
  views: {
    id: string
    type: string
    tracks?: { configuration: { trackId: string } }[]
    domainsOnGenome?: boolean
    connectedDomains?: { name: string; regions: unknown[] }[]
  }[]
  sessionTracks: unknown[]
}

function readSession(page: Page) {
  return page.evaluate(() => {
    const session = (window as unknown as { JBrowseSession: SessionHandle })
      .JBrowseSession
    const lgv = session.views.find(v => v.type === 'LinearGenomeView')
    const msa = session.views.find(v => v.type === 'MsaView')
    return {
      shown: lgv?.tracks?.map(t => t.configuration.trackId) ?? [],
      domainsOnGenome: msa?.domainsOnGenome,
      domains: msa?.connectedDomains?.map(d => d.name) ?? [],
      snapshot: JSON.parse(JSON.stringify(session)) as {
        sessionTracks: {
          trackId: string
          adapter: { features: { name: string; subfeatures: unknown[] }[] }
        }[]
      },
    }
  })
}

async function waitForDomainTrack(page: Page) {
  await page.waitForFunction(
    trackId =>
      (
        window as unknown as { JBrowseSession?: SessionHandle }
      ).JBrowseSession?.views.some(v =>
        v.tracks?.some(t => t.configuration.trackId === trackId),
      ),
    { timeout: 90_000 },
    TRACK_ID,
  )
}

run('domains on the genome', () => {
  let server: ChildProcess
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    setupJBrowse()
    const seqs = await Promise.all(Object.values(ROWS).map(fetchFasta))
    const msa = Object.keys(ROWS)
      .map((name, i) => `>${name}\n${seqs[i]}`)
      .join('\n')
    const treeMetadata = JSON.stringify(
      Object.fromEntries(
        Object.entries(ROWS).map(([name, Accession]) => [name, { Accession }]),
      ),
    )
    server = await startJBrowseServer()
    browser = await launchBrowser()
    page = await createJBrowsePage(browser)
    await page.goto(
      sessionUrl({
        name: 'domains on the genome',
        views: [
          {
            id: 'lgv1',
            type: 'LinearGenomeView',
            init: {
              assembly: 'hg38',
              loc: 'chr11:5,225,450-5,227,150',
              tracks: ['gencode.v44.annotation.sorted.gff3'],
            },
          },
          {
            id: 'msa1',
            type: 'MsaView',
            data: { msa, treeMetadata },
            querySeqName: 'Human',
            connectedViewId: 'lgv1',
            connectedFeature: hbb,
            domainsOnGenome: true,
            colWidth: 5,
          },
        ],
      }),
      { waitUntil: 'networkidle2', timeout: 60_000 },
    )
  }, 180_000)

  afterAll(async () => {
    await browser?.close()
    await stopServer(server)
  })

  test('a launch with domainsOnGenome adds the domain track once the domains load', async () => {
    await waitForDomainTrack(page)
    await new Promise(r => setTimeout(r, 5000))
    await saveScreenshot(
      page,
      path.join(SCREENSHOT_DIR, 'domains-on-genome-hbb.png'),
    )
    const { domains, domainsOnGenome, snapshot } = await readSession(page)
    expect(domains.length).toBeGreaterThan(0)
    expect(domainsOnGenome).toBe(false)
    const track = snapshot.sessionTracks.find(t => t.trackId === TRACK_ID)!
    expect(track.adapter.features.map(f => f.name)).toEqual(domains)
  }, 120_000)

  test('the track and its features survive a session snapshot round trip', async () => {
    const before = await readSession(page)
    await page.goto('about:blank')
    await page.goto(sessionUrl(before.snapshot), {
      waitUntil: 'networkidle2',
      timeout: 60_000,
    })
    await waitForDomainTrack(page)
    const after = await readSession(page)
    expect(after.shown).toContain(TRACK_ID)
    expect(after.snapshot.sessionTracks).toEqual(before.snapshot.sessionTracks)
  }, 120_000)
})
