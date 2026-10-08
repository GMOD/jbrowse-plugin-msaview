import { deflateSync } from 'node:zlib'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  JBROWSE_PORT,
  createJBrowsePage,
  launchBrowser,
  setupJBrowse,
  startJBrowseServer,
  stopServer,
} from './setup'

import type { ChildProcess } from 'node:child_process'
import type { Browser, Page } from 'puppeteer'

// The sessions jb2hubs links to are raw MsaView snapshots in the url hash, not
// `LaunchView-MsaView` specs, so the snapshot's property names are the contract
// (see jb2hubs website/src/components/proteinSession.ts). mobx-state-tree drops
// a key it does not know without a word, and a renamed property would open
// every published link on an empty import form. These boot each shape that
// site emits and read the model back.

// four codons over two exons, plus strand
const transcript = {
  uniqueId: 'tx1',
  type: 'mRNA',
  refName: 'chr1',
  start: 1000,
  end: 2006,
  strand: 1,
  name: 'tx1',
  subfeatures: [
    { type: 'CDS', start: 1000, end: 1006, strand: 1, phase: 0 },
    { type: 'CDS', start: 2000, end: 2006, strand: 1, phase: 0 },
  ],
}

const lgv = {
  id: 'lgv1',
  type: 'LinearGenomeView',
  init: { assembly: 'hg38', loc: 'chr1:900-2100', tracks: [] },
}

const linked = {
  type: 'MsaView',
  connectedViewId: 'lgv1',
  connectedFeature: transcript,
}

function sessionUrl(views: Record<string, unknown>[]) {
  const session = JSON.stringify({ name: 'snapshot contract', views })
  const encoded = deflateSync(session)
    .toString('base64')
    .replace(/=+$/, '')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
  return `http://localhost:${JBROWSE_PORT}/#config=config.json&session=encoded-${encoded}`
}

interface Region {
  refName: string
  start: number
  end: number
}

interface MsaViewHandle {
  id: string
  type: string
  error?: unknown
  rows: unknown[]
  rowMap: Map<string, string>
  querySeqName: string
  highlights?: unknown[]
  annotations: unknown[]
  init?: Record<string, unknown>
  orthologParams?: Record<string, unknown>
  blastParams?: Record<string, unknown>
  allowedGappyness: number
  transcriptToMsaMap?: unknown
  connectedView?: unknown
  connectedClickHighlights: Region[]
  setMouseClickPos: (col?: number, row?: number) => void
}

async function load(page: Page, views: Record<string, unknown>[]) {
  await page.goto('about:blank')
  await page.goto(sessionUrl(views), {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  })
  await page.waitForFunction(
    () =>
      (
        window as unknown as { JBrowseSession?: { views: unknown[] } }
      ).JBrowseSession?.views.some(
        v => (v as { type: string }).type === 'MsaView',
      ),
    { timeout: 60_000 },
  )
}

// the codon a click on `col` of view `id` lights in the genome view
async function clickRegions(page: Page, id: string, col: number) {
  return page.evaluate(
    (viewId, column) => {
      const view = (
        window as unknown as { JBrowseSession: { views: MsaViewHandle[] } }
      ).JBrowseSession.views.find(v => v.id === viewId)!
      view.setMouseClickPos(column, 0)
      return view.connectedClickHighlights.map(r => ({
        refName: r.refName,
        start: r.start,
        end: r.end,
      }))
    },
    id,
    col,
  )
}

async function waitForRows(page: Page, id: string) {
  await page.waitForFunction(
    viewId => {
      const view = (
        window as unknown as { JBrowseSession: { views: MsaViewHandle[] } }
      ).JBrowseSession.views.find(v => v.id === viewId)
      return !!view && (view.rows.length > 0 || !!view.error)
    },
    { timeout: 60_000 },
    id,
  )
}

async function readView(page: Page, id: string) {
  return page.evaluate(viewId => {
    const view = (
      window as unknown as { JBrowseSession: { views: MsaViewHandle[] } }
    ).JBrowseSession.views.find(v => v.id === viewId)!
    return {
      error: view.error ? `${view.error}` : undefined,
      rows: view.rows.length,
      hasQueryRow: view.rowMap.has(view.querySeqName),
      highlights: view.highlights?.length ?? 0,
      annotations: view.annotations.length,
      init: view.init,
      orthologParams: view.orthologParams,
      blastParams: view.blastParams,
      allowedGappyness: view.allowedGappyness,
      mapped: !!view.transcriptToMsaMap,
      connected: !!view.connectedView,
    }
  }, id)
}

describe('the MsaView snapshot a session link carries', () => {
  let browser: Browser
  let server: ChildProcess
  let page: Page

  beforeAll(async () => {
    setupJBrowse()
    server = await startJBrowseServer()
    browser = await launchBrowser()
    page = await createJBrowsePage(browser)
  }, 180_000)

  afterAll(async () => {
    await browser?.close()
    if (server) {
      await stopServer(server)
    }
  })

  it('inline rows, domains and highlights, linked to the genome by codon', async () => {
    await load(page, [
      lgv,
      {
        ...linked,
        id: 'msa-inline',
        querySeqName: 'hs',
        colorSchemeName: 'percent_identity_dynamic',
        labelsAlignRight: true,
        treeAreaWidth: 200,
        highlights: [{ row: 'hs', start: 2, end: 3, label: 'site' }],
        data: {
          msa: '>hs\nMKVL\n>mm\nMKIL\n',
          tree: '(hs:1,mm:1);',
          gff: 'hs\tCDD\tdomain\t1\t3\t.\t.\t.\tName=dom\n',
        },
      },
    ])
    await waitForRows(page, 'msa-inline')

    const view = await readView(page, 'msa-inline')
    expect(view.error).toBeUndefined()
    expect(view).toMatchObject({
      rows: 2,
      hasQueryRow: true,
      highlights: 1,
      annotations: 1,
      mapped: true,
      connected: true,
    })
    expect(await clickRegions(page, 'msa-inline', 1)).toEqual([
      { refName: 'chr1', start: 1003, end: 1006 },
    ])
    expect(await clickRegions(page, 'msa-inline', 2)).toEqual([
      { refName: 'chr1', start: 2000, end: 2003 },
    ])
  }, 180_000)

  // a row that is one segment of the translation, a Pfam seed row say: the
  // offset says where in the transcript the row starts, so the whole exon model
  // serves and nothing has to be cut to the segment
  it('a query row that starts inside the transcript, by querySeqOffset', async () => {
    await load(page, [
      lgv,
      {
        ...linked,
        id: 'msa-segment',
        querySeqName: 'hs/3-4',
        querySeqOffset: 2,
        data: { msa: '>hs/3-4\nVL\n>mm/3-4\nIL\n' },
      },
    ])
    await waitForRows(page, 'msa-segment')

    expect(await clickRegions(page, 'msa-segment', 0)).toEqual([
      { refName: 'chr1', start: 2000, end: 2003 },
    ])
    expect(await clickRegions(page, 'msa-segment', 1)).toEqual([
      { refName: 'chr1', start: 2003, end: 2006 },
    ])
  }, 180_000)

  it('one named block of a hosted indexed alignment', async () => {
    const base = 'https://jbrowse.org/demos/msaview/100way'
    await load(page, [
      lgv,
      {
        ...linked,
        id: 'msa-indexed',
        treeFilehandle: {
          uri: `${base}/hg38.multiz100way.nh`,
          locationType: 'UriLocation',
        },
        init: {
          msaIndexedLocation: {
            uri: `${base}/hg38.knownCanonical.multiz100way.aa.fa.gz`,
          },
          msaName: 'TP53',
          querySeqName: 'hg38',
        },
      },
    ])
    await waitForRows(page, 'msa-indexed')

    const view = await readView(page, 'msa-indexed')
    expect(view.error).toBeUndefined()
    expect(view.rows).toBeGreaterThan(50)
    expect(view.hasQueryRow).toBe(true)
    // kept, since it is how a reload refetches the block
    expect(view.init).toMatchObject({ msaName: 'TP53' })
  }, 180_000)

  // nothing is fetched: the services are refused, and what is read back is that
  // the request survived hydration and the view took it up as a launch
  it('a request the view builds its alignment from', async () => {
    await page.setRequestInterception(true)
    const refuse = (request: {
      url: () => string
      abort: () => Promise<void>
      continue: () => Promise<void>
    }) => {
      const blocked = /uniprot\.org|ebi\.ac\.uk|ncbi\.nlm\.nih\.gov/.test(
        request.url(),
      )
      void (blocked ? request.abort() : request.continue())
    }
    page.on('request', refuse)
    try {
      await load(page, [
        lgv,
        {
          ...linked,
          id: 'msa-uniref',
          allowedGappyness: 50,
          orthologParams: {
            taxId: 9606,
            geneCandidates: ['TP53'],
            source: 'uniref',
            identity: 50,
            msaAlgorithm: 'browser',
            proteinSequence: 'MKVL',
          },
        },
        {
          ...linked,
          id: 'msa-phmmer',
          blastParams: {
            searchProgram: 'phmmer',
            blastDatabase: 'swissprot',
            maxHits: 50,
            proteinSequence: 'MKVL',
          },
        },
      ])
      await waitForRows(page, 'msa-uniref')
      await waitForRows(page, 'msa-phmmer')

      const uniref = await readView(page, 'msa-uniref')
      expect(uniref.orthologParams).toMatchObject({
        source: 'uniref',
        identity: 50,
        geneCandidates: ['TP53'],
      })
      expect(uniref.allowedGappyness).toBe(50)
      expect(uniref.error).toMatch(/uniprot/i)

      const phmmer = await readView(page, 'msa-phmmer')
      expect(phmmer.blastParams).toMatchObject({
        searchProgram: 'phmmer',
        blastDatabase: 'swissprot',
        maxHits: 50,
      })
      expect(phmmer.error).toMatch(/ebi/i)
    } finally {
      page.off('request', refuse)
      await page.setRequestInterception(false)
    }
  }, 180_000)
})
