import fs from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  createJBrowsePage,
  getTestJBrowseDir,
  launchBrowser,
  saveScreenshot,
  setupJBrowse,
  startJBrowseServer,
  stopServer,
  waitForJBrowseLoad,
} from './setup'

import type { ChildProcess } from 'node:child_process'
import type { Browser, Page } from 'puppeteer'

// Opt-in (SCREENSHOT_DOMAINS=1): seeds a real alignment of NCBI proteins (no
// BLAST) into a defaultSession, opens the MsaView, and screenshots. The view
// auto-fetches CDD domains for accession-bearing rows, so the domain overlay
// appears on its own after the live efetch.
const run = process.env.SCREENSHOT_DOMAINS ? describe : describe.skip

const ACCESSIONS = ['NP_002736.3', 'NP_001035145.1', 'NP_620407.1']
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots')

async function fetchFasta(accession: string) {
  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=${accession}&rettype=fasta&retmode=text&tool=jbrowse-plugin-msaview&email=colin.diesh@gmail.com`
  const text = await (await fetch(url)).text()
  return text.split('\n').slice(1).join('').replace(/\s/g, '')
}

run('protein domain overlay screenshot', () => {
  let server: ChildProcess
  let browser: Browser
  let page: Page
  const domainErrors: string[] = []

  beforeAll(async () => {
    setupJBrowse()

    // build a real alignment and seed it as a defaultSession. A raw MST snapshot
    // round-trips data.treeMetadata (the session-spec URL form drops it), which
    // is what carries the NCBI accessions the auto-loader keys off.
    const seqs = await Promise.all(ACCESSIONS.map(fetchFasta))
    const rowNames = ACCESSIONS.map(a => a.replace(/\..*$/, ''))
    const msa = rowNames.map((name, i) => `>${name}\n${seqs[i]}`).join('\n')
    const treeMetadata = JSON.stringify(
      Object.fromEntries(
        rowNames.map((name, i) => [name, { Accession: ACCESSIONS[i] }]),
      ),
    )

    // shrink colWidth so the whole alignment width fits in the view (the
    // screenshot then shows each domain spanning the entire sequence)
    const longest = Math.max(...seqs.map(s => s.length))
    const colWidth = Math.max(1, Math.floor(800 / longest))

    const configPath = path.join(getTestJBrowseDir(), 'config.json')
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    config.defaultSession = {
      name: 'domain-screenshot',
      views: [{ type: 'MsaView', colWidth, data: { msa, treeMetadata } }],
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    server = await startJBrowseServer()
    browser = await launchBrowser()
    page = await createJBrowsePage(browser)
    // createJBrowsePage already navigated (networkidle2), so the MsaView was
    // created and its domain auto-load ran before any listener here was
    // attached. Listen now, then reload so the autorun re-runs while we're
    // watching for any auto-load failure.
    page.on('console', m => {
      const t = m.text()
      if (t.includes('[msaview-domains] auto-load failed')) {
        domainErrors.push(t)
      }
    })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60_000 })
    await waitForJBrowseLoad(page)
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await stopServer(server)
  })

  test('auto-overlays CDD domains on an accession-bearing alignment', async () => {
    await page.waitForSelector('canvas', { timeout: 30_000 })
    await saveScreenshot(
      page,
      path.join(SCREENSHOT_DIR, 'domains-01-loaded.png'),
    )

    // wait for the auto-fetch (live efetch + parse + render) to complete
    await new Promise(r => setTimeout(r, 12_000))
    await saveScreenshot(
      page,
      path.join(SCREENSHOT_DIR, 'domains-02-overlay.png'),
    )

    const hasCanvas = await page.evaluate(
      () => document.querySelectorAll('canvas').length > 0,
    )
    expect(hasCanvas).toBe(true)
    expect(domainErrors).toEqual([])
  }, 120_000)
})
