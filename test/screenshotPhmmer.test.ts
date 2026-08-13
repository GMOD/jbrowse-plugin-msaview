import fs from 'node:fs'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import {
  JBROWSE_PORT,
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

// Opt-in (SCREENSHOT_PHMMER=1): seeds the alignment, tree and metadata a real
// phmmer run produced, then screenshots the view and the launch dialog.
//
// The fixtures are real pipeline output — buildPhmmerMsa over a live
// hmmer3_phmmer search of human albumin against swissprot, and the
// simple_phylogeny tree built from it — rather than a search run here, so the
// screenshots are the same every time and do not depend on EBI being quick.
// test/phmmerLive.test.ts is what covers the live path.
const run = process.env.SCREENSHOT_PHMMER ? describe : describe.skip

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots')
const VIEW_TITLE = 'phmmer - human albumin vs swissprot'

function fixture(name: string) {
  return fs.readFileSync(
    path.join(
      path.dirname(new URL(import.meta.url).pathname),
      'fixtures',
      name,
    ),
    'utf8',
  )
}

// restoring rather than deleting: the stock defaultSession is what puts a
// genome view on screen, and the dialog is reached by right-clicking a gene in it
let stockSession: unknown

function writeConfig(defaultSession?: unknown) {
  const configPath = path.join(getTestJBrowseDir(), 'config.json')
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  stockSession ??= config.defaultSession
  config.defaultSession = defaultSession ?? stockSession
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

run('phmmer screenshots', () => {
  let server: ChildProcess
  let browser: Browser
  let page: Page

  beforeAll(async () => {
    setupJBrowse()

    // the config has to carry the view before the page is ever opened: jbrowse
    // keeps the live session in storage and restores that on reload, so a
    // defaultSession written later is never read
    writeConfig({
      name: 'phmmer-screenshot',
      views: [
        {
          type: 'MsaView',
          displayName: VIEW_TITLE,
          colWidth: 8,
          rowHeight: 14,
          drawNodeBubbles: true,
          treeWidth: 260,
          data: {
            msa: fixture('phmmer-albumin-msa.fa'),
            tree: fixture('phmmer-albumin-tree.nh'),
            treeMetadata: fixture('phmmer-albumin-metadata.json'),
          },
        },
      ],
    })

    server = await startJBrowseServer()
    browser = await launchBrowser()
    page = await createJBrowsePage(browser)
  }, 180_000)

  afterAll(async () => {
    writeConfig()
    await browser?.close()
    await stopServer(server)
  })

  test('renders the alignment and tree phmmer produced', async () => {
    await waitForJBrowseLoad(page)
    await page.waitForSelector('canvas', { timeout: 30_000 })
    await new Promise(r => setTimeout(r, 4000))

    await saveScreenshot(
      page,
      path.join(SCREENSHOT_DIR, 'phmmer-01-alignment.png'),
    )

    // a canvas alone proves nothing — the genome view draws one too, and this
    // passed against the default session before the content was checked
    const text = await page.evaluate(() => document.body.innerText)
    expect(text).not.toContain('GENCODE')
    expect(await page.evaluate(() => document.title)).toBeTruthy()
  }, 120_000)

  test('offers phmmer in the launch dialog', async () => {
    writeConfig()
    // the seeded session outlives a plain reload, so drop it first — and go to
    // the bare url rather than reloading, which would carry the dead
    // ?session=local-... of the session just cleared
    await page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    await page.goto(`http://localhost:${JBROWSE_PORT}/`, {
      waitUntil: 'networkidle2',
      timeout: 60_000,
    })
    await waitForJBrowseLoad(page)

    const search = await page.waitForSelector('input[placeholder*="Search"]', {
      timeout: 20_000,
    })
    await search!.click()
    await search!.type('SPATA6')
    await new Promise(r => setTimeout(r, 2500))
    await page.waitForSelector('[role="option"]', { timeout: 10_000 })
    const option = (
      await page.evaluateHandle(() => {
        const opts = [...document.querySelectorAll('[role="option"]')]
        return (
          opts.find(
            o =>
              (o.textContent ?? '').includes('(SPATA6)') &&
              !(o.textContent ?? '').includes('(SPATA6L)'),
          ) ?? null
        )
      })
    ).asElement()
    await option!.click()
    await new Promise(r => setTimeout(r, 3000))

    const target = await page.evaluate(() => {
      for (const el of [
        ...document.querySelectorAll('div, span, text, tspan'),
      ]) {
        const own = [...el.childNodes]
          .filter(n => n.nodeType === 3)
          .map(n => n.textContent ?? '')
          .join('')
        if (own.includes('SPATA6') && !own.includes('SPATA6L')) {
          const b = el.getBoundingClientRect()
          if (b.y > 150 && b.y < 500 && b.width > 0) {
            return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
          }
        }
      }
      return null
    })
    if (!target) {
      throw new Error('SPATA6 feature not found to right-click')
    }
    await page.mouse.click(target.x, target.y, { button: 'right' })
    await new Promise(r => setTimeout(r, 1200))

    const items = await page.$$('[role="menuitem"]')
    let launch = null
    for (const item of items) {
      const t = await page.evaluate(el => (el as HTMLElement).textContent, item)
      if (t?.includes('Launch MSA view')) {
        launch = item
        break
      }
    }
    if (!launch) {
      throw new Error('"Launch MSA view" not in context menu')
    }
    await launch.click()
    await new Promise(r => setTimeout(r, 3000))

    // the dialog opens on the orthologs tab
    const onBlastTab = await page.evaluate(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')].find(t =>
        t.textContent?.toUpperCase().includes('BLAST'),
      )
      if (!tab) {
        return false
      }
      ;(tab as HTMLElement).click()
      return true
    })
    if (!onBlastTab) {
      throw new Error('BLAST tab not found in the launch dialog')
    }
    await new Promise(r => setTimeout(r, 2000))

    await saveScreenshot(
      page,
      path.join(SCREENSHOT_DIR, 'phmmer-02-dialog-blastp.png'),
    )

    // switch the new Search program select to phmmer: the database options
    // change with it and the MSA algorithm select goes away.
    // a real mouse click, because MUI's Select opens on mousedown and ignores
    // a synthetic element.click()
    const box = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="combobox"]')].find(c =>
        c
          .closest('.MuiFormControl-root')
          ?.textContent?.includes('Search program'),
      )
      if (!el) {
        return null
      }
      const b = el.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    })
    if (!box) {
      throw new Error('Search program select not found in the dialog')
    }
    await page.mouse.click(box.x, box.y)
    await new Promise(r => setTimeout(r, 1000))
    const optionBox = await page.evaluate(() => {
      const el = [...document.querySelectorAll('[role="option"]')].find(
        o => o.textContent?.trim() === 'phmmer',
      )
      if (!el) {
        return null
      }
      const b = el.getBoundingClientRect()
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
    })
    if (!optionBox) {
      throw new Error('phmmer option not present in the Search program select')
    }
    await page.mouse.click(optionBox.x, optionBox.y)
    await new Promise(r => setTimeout(r, 1500))

    await saveScreenshot(
      page,
      path.join(SCREENSHOT_DIR, 'phmmer-03-dialog-phmmer.png'),
    )

    expect(await page.evaluate(() => document.body.innerText)).toContain(
      'profile HMM',
    )
  }, 180_000)
})
