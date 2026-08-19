import fs from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  createJBrowsePage,
  getJBrowseVersion,
  launchBrowser,
  saveScreenshot,
  setupJBrowse,
  startJBrowseServer,
  stopServer,
  waitForJBrowseLoad,
} from './setup'

import type { ChildProcess } from 'node:child_process'
import type { Browser, Page } from 'puppeteer'

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots')

function getScreenshotPath(name: string) {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
  return path.join(SCREENSHOT_DIR, `${getJBrowseVersion()}-${name}.png`)
}

async function openMsaDialog(p: Page) {
  const searchInput = await p.waitForSelector('input[placeholder*="Search"]', {
    timeout: 10_000,
  })
  await searchInput!.click()
  await searchInput!.type('SPATA6')
  await new Promise(r => setTimeout(r, 2000))
  await p.waitForSelector('[role="option"]', { timeout: 5000 })

  // SPATA6L also matches the search, and picking it lands on a different gene
  const spata6 = await p.evaluateHandle(
    () =>
      Array.from(document.querySelectorAll('[role="option"]')).find(opt => {
        const t = opt.textContent ?? ''
        return t.includes('(SPATA6)') && !t.includes('(SPATA6L)')
      }) ?? null,
  )
  const spata6El = spata6.asElement()
  if (spata6El) {
    await spata6El.click()
  } else {
    await p.keyboard.press('ArrowDown')
    await new Promise(r => setTimeout(r, 200))
    await p.keyboard.press('Enter')
  }
  await new Promise(r => setTimeout(r, 3000))

  const clickTarget = await p.evaluate(() => {
    for (const el of Array.from(
      document.querySelectorAll('div, span, tspan'),
    )) {
      const own = Array.from(el.childNodes)
        .filter(n => n.nodeType === 3)
        .map(n => n.textContent ?? '')
        .join('')
      if (own.includes('SPATA6') && !own.includes('SPATA6L')) {
        const bbox = el.getBoundingClientRect()
        if (bbox.y > 150 && bbox.y < 500 && bbox.width > 0) {
          return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
        }
      }
    }
    return null
  })
  if (clickTarget) {
    await p.mouse.click(clickTarget.x, clickTarget.y, { button: 'right' })
    await new Promise(r => setTimeout(r, 1000))
  }

  let menuItems = await p.$$('[role="menuitem"]')
  if (menuItems.length === 0) {
    // features paint on a canvas, so fall back to the GENCODE track's own box
    await p.keyboard.press('Escape')
    await new Promise(r => setTimeout(r, 500))
    const trackBox = await p.evaluate(() => {
      for (const label of Array.from(document.querySelectorAll('*'))) {
        if (label.textContent?.includes('GENCODE')) {
          let parent = label.parentElement
          while (parent) {
            const bbox = parent.getBoundingClientRect()
            if (bbox.width > 500 && bbox.height > 50 && bbox.height < 300) {
              return {
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height,
              }
            }
            parent = parent.parentElement
          }
        }
      }
      return null
    })
    if (!trackBox) {
      throw new Error('no SPATA6 feature or GENCODE track found to right-click')
    }
    await p.mouse.click(
      trackBox.x + trackBox.width * 0.15,
      trackBox.y + trackBox.height * 0.78,
      { button: 'right' },
    )
    await new Promise(r => setTimeout(r, 1000))
    menuItems = await p.$$('[role="menuitem"]')
  }
  for (const item of menuItems) {
    const text = await p.evaluate(el => (el as HTMLElement).textContent, item)
    if (text?.includes('Launch MSA view')) {
      await item.click()
      await new Promise(r => setTimeout(r, 3000))
      return
    }
  }
  throw new Error('"Launch MSA view" not in context menu')
}

async function clickByText(p: Page, selector: string, text: string) {
  const handle = await p.evaluateHandle(
    (sel, t) =>
      Array.from(document.querySelectorAll(sel)).find(el =>
        el.textContent?.includes(t),
      ) ?? null,
    selector,
    text,
  )
  const el = handle.asElement()
  if (!el) {
    throw new Error(`no ${selector} containing "${text}"`)
  }
  await el.click()
  await new Promise(r => setTimeout(r, 800))
}

/**
 * The paste route is the only way to reach NCBI's `nr`, and its one failure mode
 * is silent: launch with the wrong MSA row name and the view renders perfectly
 * while clicking it never navigates. So this drives the real dialog and asserts
 * the row filled itself in, which is the part a unit test on detectQueryRow
 * cannot see -- that the value reaches the field the launch actually reads.
 */
describe('BLAST paste workflow E2E', () => {
  let server: ChildProcess | undefined
  let browser: Browser | undefined
  let page: Page | undefined

  beforeAll(async () => {
    setupJBrowse()
    server = await startJBrowseServer()
    browser = await launchBrowser()
    page = await createJBrowsePage(browser)
    await waitForJBrowseLoad(page)
  }, 180_000)

  afterAll(async () => {
    await browser?.close()
    if (server) {
      await stopServer(server)
    }
  })

  it('auto-fills the MSA row from a pasted alignment', async () => {
    const p = page!
    await openMsaDialog(p)
    expect(await p.$('[role="dialog"]')).not.toBeNull()

    await clickByText(p, '[role="tab"]', 'BLAST query')
    await clickByText(p, '.MuiFormControlLabel-root', 'Manual')
    await saveScreenshot(p, getScreenshotPath('30-blast-manual-steps'))

    // the panel fetches and translates the transcript before it can build the
    // link, so the sequence is not there on first paint
    await p.waitForFunction(
      () =>
        Array.from(document.querySelectorAll('a')).some(a =>
          a.href.includes('PAGE_TYPE=BlastSearch'),
        ),
      { timeout: 30_000 },
    )

    // the protein the dialog computed for the selected transcript, so the
    // pasted alignment genuinely corresponds to this gene
    const protein = await p.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a =>
        a.href.includes('PAGE_TYPE=BlastSearch'),
      )
      return new URL(link!.href).searchParams.get('QUERY') ?? ''
    })
    expect(protein.length).toBeGreaterThan(20)

    const alignment = [
      'CLUSTAL O(1.2.4) multiple sequence alignment',
      '',
      `Query_1              ${protein}\t${protein.length}`,
      `homolog_a            ${'A'.repeat(protein.length)}\t${protein.length}`,
      '',
    ].join('\n')

    const msaBox = await p.$('textarea[placeholder*="aln"]')
    if (!msaBox) {
      throw new Error('alignment paste box not rendered')
    }
    await msaBox.click()
    await p.evaluate(
      (el, text) => {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          'value',
        )!.set!
        setter.call(el, text)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      },
      msaBox,
      alignment,
    )
    await new Promise(r => setTimeout(r, 1500))
    await saveScreenshot(p, getScreenshotPath('31-blast-manual-detected'))

    const detected = await p.evaluate(() =>
      Array.from(document.querySelectorAll('[role="dialog"] *')).some(el =>
        el.textContent?.includes('Matched'),
      ),
    )
    expect(detected).toBe(true)

    // the value the launch actually reads, not just the banner above it
    const rowValue = await p.evaluate(
      () =>
        Array.from(document.querySelectorAll('[role="combobox"]'))
          .map(el => el.textContent ?? '')
          .find(t => t.includes('Query_1')) ?? '',
    )
    expect(rowValue).toContain('Query_1')

    const submitEnabled = await p.evaluate(() => {
      const button = Array.from(
        document.querySelectorAll('[role="dialog"] button'),
      ).find(b => b.textContent?.trim() === 'Submit')
      return !!button && !(button as HTMLButtonElement).disabled
    })
    expect(submitEnabled).toBe(true)
  }, 180_000)
})
