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

// A two-row alignment inline, so the spec needs no fetch and the test is about
// the layout rather than about loading an MSA.
const MSA = ['>a', 'ACGTACGT', '>b', 'ACGAACGT', ''].join('\n')

function specUrl(placement?: string) {
  const spec = {
    views: [
      {
        type: 'LinearGenomeView',
        id: 'lgv1',
        assembly: 'hg38',
        loc: 'chr1:1-10000',
      },
      {
        type: 'MsaView',
        connectedViewId: 'lgv1',
        data: { msa: MSA },
        ...(placement ? { placement } : {}),
      },
    ],
  }
  return `http://localhost:${JBROWSE_PORT}/?config=config.json&session=spec-${encodeURIComponent(JSON.stringify(spec))}`
}

// Grid cells, left to right. A stacked session has no workspace at all, so an
// empty list is the "not tiled" answer rather than a failure to find anything.
async function panelBoxes(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-panel-id]')]
      .map(el => el.getBoundingClientRect())
      .map(r => ({ left: r.left, width: r.width }))
      .sort((a, b) => a.left - b.left),
  )
}

// Whether THIS host can tile at all -- the same two actions the plugin itself
// feature-detects. The test matrix runs every leg against v4.3.0 and v3.7.0 as
// well as nightly, and those hosts have no workspaces: asserting a split there
// would be asserting that an old release grew a feature.
async function hostCanTile(page: Page) {
  return page.evaluate(() => {
    const session = (
      window as unknown as { JBrowseSession?: Record<string, unknown> }
    ).JBrowseSession
    return (
      typeof session?.setPendingMove === 'function' &&
      typeof session?.setUseWorkspaces === 'function'
    )
  })
}

// What the spec actually launched. Separate from the panel lookup below
// because `panelContainingView` is a workspaces-only action and does not exist
// on the older matrix legs at all.
async function viewTypes(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as { JBrowseSession?: { views: { type: string }[] } }
      ).JBrowseSession?.views.map(v => v.type) ?? [],
  )
}

// Which grid cell each view sits in, straight off the session model that owns
// the layout -- the DOM says two cells exist, this says the alignment is in the
// one that is not the genome view's.
async function panelOfEachView(page: Page) {
  return page.evaluate(() => {
    const session = (
      window as unknown as {
        JBrowseSession?: {
          views: { id: string; type: string }[]
          panelContainingView: (id: string) => { id: string } | undefined
        }
      }
    ).JBrowseSession
    return (session?.views ?? []).map(view => ({
      type: view.type,
      panel: session?.panelContainingView(view.id)?.id,
    }))
  })
}

async function load(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
  await page.waitForFunction(
    () => (document.querySelector('#root')?.children.length ?? 0) > 0,
    { timeout: 30_000 },
  )
  await new Promise(r => {
    setTimeout(r, 5000)
  })
}

describe('spec placement', () => {
  let browser: Browser
  let server: ChildProcess

  beforeAll(async () => {
    setupJBrowse()
    server = await startJBrowseServer()
    browser = await launchBrowser()
  }, 180_000)

  afterAll(async () => {
    await browser.close()
    await stopServer(server)
  })

  it('splitRight puts the alignment in its own cell beside the genome view', async () => {
    const page = await createJBrowsePage(browser)
    await load(page, specUrl('splitRight'))

    // Both views launched, whatever the host then does with them -- without
    // this the older legs below would pass just as well on a page that failed
    // to load anything at all.
    expect(await viewTypes(page)).toEqual(['LinearGenomeView', 'MsaView'])

    // The documented degradation, and what the older matrix legs assert: a host
    // with no workspaces stacks, and the link still opens.
    if (!(await hostCanTile(page))) {
      expect(await panelBoxes(page)).toHaveLength(0)
      await page.close()
      return
    }

    const boxes = await panelBoxes(page)
    expect(boxes).toHaveLength(2)
    expect(boxes[0]!.left + boxes[0]!.width).toBeLessThanOrEqual(
      boxes[1]!.left + 1,
    )

    const placed = await panelOfEachView(page)
    expect(placed[0]!.panel).toBeDefined()
    expect(placed[1]!.panel).toBeDefined()
    expect(placed[1]!.panel).not.toBe(placed[0]!.panel)
    await page.close()
  }, 180_000)

  // the guarantee that makes `stack` a safe default: a link written before the
  // key existed opens exactly as it did
  it('a spec that says nothing is not tiled', async () => {
    const page = await createJBrowsePage(browser)
    await load(page, specUrl())
    expect(await panelBoxes(page)).toHaveLength(0)
    await page.close()
  }, 180_000)
})
