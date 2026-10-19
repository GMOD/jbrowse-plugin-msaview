import path from 'node:path'
import { deflateSync } from 'node:zlib'

import { launch } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { candidateServer } from '../scripts/serveCandidate.mjs'
import { buildPlugin, saveScreenshot } from './setup'

import type { Browser, Page } from 'puppeteer'

// Checks the connectedDomains contract (docs/linked-views.md) between this
// working tree and the protein3d build users pair it with, the store's
// `latestUrl`, on hosted JBrowse `main` under the hg38 config that names both
// plugins. Each side's unit tests read the shape off a fake; this one reads it
// across the two real plugins. Opt-in (SCREENSHOT_DOMAINS=1), since the domains come from a
// live NCBI efetch and the structure from RCSB.
const run = process.env.SCREENSHOT_DOMAINS ? describe : describe.skip

const HOST = 'https://jbrowse.org/code/jb2/main/'
const CONFIG = 'https://jbrowse.org/ucsc/hg38/config.json'
const PROTEIN3D_LATEST =
  'https://jbrowse.org/plugins/jbrowse-plugin-protein3d/latest/dist/jbrowse-plugin-protein3d.esm.js'
const SCREENSHOT = path.join(
  process.cwd(),
  'test-screenshots',
  'domain-contract-hbb-2hbs.png',
)

const ROWS = {
  Human: 'NP_000509.1',
  Mouse: 'NP_058652.1',
  Chicken: 'NP_990820.1',
}
const MSA_ID = 'msa1'
const TRACK_ID = `msaview-domains-${MSA_ID}`
// the proximal heme histidine, β His92 in 2HBS's numbering
const HEME_HIS = 92

const hbb = {
  uniqueId: 'NM_000518.5',
  type: 'mRNA',
  refName: 'chr11',
  start: 5225597,
  end: 5227021,
  strand: -1,
  name: 'NM_000518.5',
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

function sessionUrl(msa: string, treeMetadata: string, protein: string) {
  const session = {
    name: 'domain contract',
    views: [
      {
        id: 'lgv1',
        type: 'LinearGenomeView',
        init: {
          assembly: 'hg38',
          loc: 'chr11:5,225,450-5,227,150',
          tracks: ['hg38-ncbiRefSeqSelect'],
        },
      },
      {
        id: MSA_ID,
        type: 'MsaView',
        data: { msa, treeMetadata },
        querySeqName: 'Human',
        connectedViewId: 'lgv1',
        connectedFeature: hbb,
        domainsOnGenome: true,
        height: 250,
        colWidth: 6,
      },
      {
        id: 'protein1',
        type: 'ProteinView',
        height: 500,
        color: { field: 'domain' },
        structures: [
          {
            pdbId: '2hbs',
            feature: hbb,
            // a snapshot, unlike a launch, does not translate the transcript
            userProvidedTranscriptSequence: protein,
            connectedViewId: 'lgv1',
          },
        ],
      },
    ],
  }
  const encoded = deflateSync(JSON.stringify(session)).toString('base64url')
  return `${HOST}?config=${encodeURIComponent(CONFIG)}&session=encoded-${encoded}`
}

interface Placed {
  entityId: string
  byLabelSeqId: Map<number, number>
}

interface ContractWindow {
  JBrowseSession?: {
    views: {
      type: string
      tracks?: { configuration: { trackId: string } }[]
      // read across the plugin boundary, so nothing in its shape is given
      connectedDomains?: {
        features?: {
          name: string
          accession: string
          kind: string
          regions: unknown[]
        }[]
        color?: { domain: string[]; range: string[]; labels: string[] }
      }
      structures?: {
        statusMessage?: string
        mappedEntity?: { entityId: string; seq: string; seqIds: number[] }
        placedValues?: Placed
        alignmentDomainStatus?: { placedSites?: Placed }
      }[]
      molstarPluginContext?: {
        state: {
          data: {
            cells: Map<string, { transform: { tags?: string[] } }>
          }
        }
      }
    }[]
    sessionTracks: unknown[]
  }
}

// One read of both plugins' models, as plain data
function readContract(page: Page) {
  return page.evaluate(() => {
    const session = (window as unknown as ContractWindow).JBrowseSession
    const views = session?.views ?? []
    const lgv = views.find(v => v.type === 'LinearGenomeView')
    const msa = views.find(v => v.type === 'MsaView')
    const protein = views.find(v => v.type === 'ProteinView')
    const structure = protein?.structures?.[0]
    const entity = structure?.mappedEntity
    const placed = structure?.placedValues
    const sites = structure?.alignmentDomainStatus?.placedSites
    const cells = protein?.molstarPluginContext?.state.data.cells
    const sessionTracks = JSON.parse(
      JSON.stringify(session?.sessionTracks ?? []),
    ) as {
      trackId: string
      adapter: { features: { name: string }[] }
    }[]
    return {
      ready: !!document.querySelector('[data-testid="protein-view-ready"]'),
      shownTracks: lgv?.tracks?.map(t => t.configuration.trackId) ?? [],
      domainTrackFeatures: sessionTracks
        .find(t => t.trackId.startsWith('msaview-domains-'))
        ?.adapter.features.map(f => f.name),
      features:
        msa?.connectedDomains?.features?.map(f => ({
          name: f.name,
          accession: f.accession,
          kind: f.kind,
          regions: f.regions.length,
        })) ?? [],
      color: msa?.connectedDomains?.color,
      structureStatus: structure?.statusMessage,
      entity: entity && {
        entityId: entity.entityId,
        seq: entity.seq,
        seqIds: [...entity.seqIds],
      },
      placed: placed && {
        entityId: placed.entityId,
        byLabelSeqId: Object.fromEntries(placed.byLabelSeqId),
      },
      sites: sites && {
        entityId: sites.entityId,
        byLabelSeqId: Object.fromEntries(sites.byLabelSeqId),
      },
      sticks: cells
        ? [...cells.values()].filter(c =>
            c.transform.tags?.includes('jbrowse-alignment-sites'),
          ).length
        : 0,
    }
  })
}

type Contract = Awaited<ReturnType<typeof readContract>>

run('the connectedDomains contract with protein3d', () => {
  let browser: Browser
  let page: Page
  let state: Contract
  const protein3dUrls: string[] = []

  beforeAll(async () => {
    buildPlugin()
    const seqs = await Promise.all(Object.values(ROWS).map(fetchFasta))
    const msa = Object.keys(ROWS)
      .map((name, i) => `>${name}\n${seqs[i]}`)
      .join('\n')
    const treeMetadata = JSON.stringify(
      Object.fromEntries(
        Object.entries(ROWS).map(([name, Accession]) => [name, { Accession }]),
      ),
    )
    // molstar needs WebGL, which headless Chrome draws only through swiftshader
    browser = await launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-unsafe-swiftshader',
      ],
    })
    page = await browser.newPage()
    await page.setViewport({ width: 1400, height: 1500 })
    page.on('pageerror', err => {
      console.log(`[browser page error] ${err.message}`)
    })
    page.on('request', req => {
      if (req.url().includes('jbrowse-plugin-protein3d')) {
        protein3dUrls.push(req.url())
      }
    })
    await candidateServer('dist/jbrowse-plugin-msaview.esm.js', {
      latest: ['Protein3d'],
    })(page)
    await page.goto(sessionUrl(msa, treeMetadata, seqs[0]!), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })

    const deadline = Date.now() + 240_000
    for (;;) {
      state = await readContract(page)
      const settled =
        state.ready &&
        state.features.some(f => f.kind === 'site') &&
        state.domainTrackFeatures &&
        state.placed &&
        state.sites &&
        state.sticks > 0
      if (settled || Date.now() > deadline) {
        break
      }
      await new Promise(r => setTimeout(r, 3000))
    }
    await new Promise(r => setTimeout(r, 5000))
    await page.addStyleTag({
      content:
        '.msp-background-tasks, .msp-highlight-info { display: none !important; }',
    })
    await page.mouse.move(5, 5)
    state = await readContract(page)
    await saveScreenshot(page, SCREENSHOT)
  }, 360_000)

  afterAll(async () => {
    await browser?.close()
  })

  test('protein3d loads from its latest store url', () => {
    expect(protein3dUrls[0]).toBe(PROTEIN3D_LATEST)
  })

  test('connectedDomains has Hb-beta-like as a domain and the heme binding site as a site', () => {
    const { features, color } = state
    expect(features).toContainEqual(
      expect.objectContaining({
        name: expect.stringMatching(/Hb-beta[_-]like/i),
        kind: 'domain',
      }),
    )
    expect(features).toContainEqual(
      expect.objectContaining({
        name: expect.stringMatching(/heme binding/i),
        kind: 'site',
      }),
    )
    expect(color?.domain).toEqual(features.map(f => f.accession))
    expect(color?.labels).toEqual(features.map(f => f.name))
  })

  test('the genome view shows the domain track with a feature per domain', () => {
    expect(state.shownTracks).toContain(TRACK_ID)
    expect(state.domainTrackFeatures).toEqual(state.features.map(f => f.name))
  })

  test('the structure colors its β chain by the domains', () => {
    const { entity, placed, structureStatus } = state
    expect(structureStatus).toBeUndefined()
    expect(entity?.seq).toMatch(/^VHLTP/)
    expect(placed?.entityId).toBe(entity?.entityId)
    expect(Object.keys(placed?.byLabelSeqId ?? {}).length).toBeGreaterThan(100)
  })

  test('the heme site draws as sticks, His92 in its color', () => {
    const { entity, sites, features, color, sticks } = state
    expect(sticks).toBeGreaterThan(0)
    const heme = features.find(f => /heme binding/i.test(f.name))!
    expect(entity?.seq[entity.seqIds.indexOf(HEME_HIS)]).toBe('H')
    expect(sites?.entityId).toBe(entity?.entityId)
    expect(sites?.byLabelSeqId[HEME_HIS]).toBe(
      color?.domain.indexOf(heme.accession),
    )
  })
})
