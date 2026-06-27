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
  const version = getJBrowseVersion()
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
  return path.join(SCREENSHOT_DIR, `${version}-${name}.png`)
}

describe('TranscriptSelector E2E', () => {
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
    if (browser) {
      await browser.close()
    }
    if (server) {
      await stopServer(server)
    }
  })

  it('should load JBrowse with the MSA plugin', async () => {
    const p = page!
    const root = await p.$('#root')
    expect(root).not.toBeNull()
    await saveScreenshot(p, getScreenshotPath('01-initial-load'))
  }, 30_000)

  it('should open MSA dialog when right-clicking on SPATA6 gene', async () => {
    const p = page!

    const searchInput = await p.waitForSelector(
      'input[placeholder*="Search"]',
      { timeout: 10_000 },
    )
    if (!searchInput) {
      throw new Error('Could not find search input')
    }

    await searchInput.click()
    await searchInput.type('SPATA6')
    await new Promise(r => setTimeout(r, 2000))
    await saveScreenshot(p, getScreenshotPath('02-search-results'))

    await p.waitForSelector('[role="option"]', { timeout: 5000 })

    // Select SPATA6 specifically (not SPATA6L, which also matches)
    const spata6Option = await p.evaluateHandle(() => {
      const options = Array.from(document.querySelectorAll('[role="option"]'))
      return (
        options.find(opt => {
          const t = opt.textContent ?? ''
          return t.includes('(SPATA6)') && !t.includes('(SPATA6L)')
        }) ?? null
      )
    })
    const optionEl = spata6Option.asElement()
    if (optionEl) {
      await optionEl.click()
    } else {
      await p.keyboard.press('ArrowDown')
      await new Promise(r => setTimeout(r, 200))
      await p.keyboard.press('Enter')
    }

    await new Promise(r => setTimeout(r, 3000))
    await saveScreenshot(p, getScreenshotPath('03-after-search'))

    // Try SVG text labels first, then feature rects
    const clickTarget = await p.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll('text, tspan'))) {
        const t = el.textContent ?? ''
        if (t.includes('SPATA6') || t.includes('ENSG00000106686')) {
          const bbox = el.getBoundingClientRect()
          if (bbox.y > 150 && bbox.y < 500) {
            return { x: bbox.x + bbox.width / 2, y: bbox.y + 10 }
          }
        }
      }
      for (const rect of Array.from(document.querySelectorAll('svg rect'))) {
        const bbox = rect.getBoundingClientRect()
        const fill = rect.getAttribute('fill')
        if (
          bbox.width > 3 &&
          bbox.height > 3 &&
          bbox.height < 25 &&
          bbox.y > 185 &&
          bbox.y < 500 &&
          fill &&
          fill !== 'none' &&
          fill !== 'white' &&
          fill !== '#fff' &&
          fill !== '#ffffff'
        ) {
          return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height / 2 }
        }
      }
      return null
    })

    if (clickTarget) {
      await saveScreenshot(p, getScreenshotPath('04-feature-found'))
      await p.mouse.click(clickTarget.x, clickTarget.y, { button: 'right' })
      await new Promise(r => setTimeout(r, 1000))
    }

    let menuItems = await p.$$('[role="menuitem"]')
    if (menuItems.length === 0) {
      // Fall back to GENCODE track bounding box
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
        throw new Error(
          'No gene feature or GENCODE track area found to right-click',
        )
      }

      // Track sidebar is ~13% of total width; 15%/78% targets the SPATA6 region
      await p.mouse.click(
        trackBox.x + trackBox.width * 0.15,
        trackBox.y + trackBox.height * 0.78,
        { button: 'right' },
      )
      await new Promise(r => setTimeout(r, 1000))
      menuItems = await p.$$('[role="menuitem"]')
    }

    await saveScreenshot(p, getScreenshotPath('05-context-menu'))

    if (menuItems.length === 0) {
      throw new Error(
        'Context menu did not appear after right-clicking on track feature',
      )
    }

    let launchItem = null
    for (const item of menuItems) {
      const text = await p.evaluate(el => (el as HTMLElement).textContent, item)
      if (text?.includes('Launch MSA view')) {
        launchItem = item
        break
      }
    }
    if (!launchItem) {
      throw new Error('"Launch MSA view" not found in context menu')
    }

    await launchItem.click()
    await new Promise(r => setTimeout(r, 3000))
    await saveScreenshot(p, getScreenshotPath('06-msa-dialog'))

    const dialog = await p.$('[role="dialog"]')
    if (!dialog) {
      throw new Error(
        'MSA dialog did not open after clicking "Launch MSA view"',
      )
    }

    await saveScreenshot(p, getScreenshotPath('07-msa-dialog-content'))

    const isoformSelect = await p.evaluateHandle(() => {
      const comboboxes = Array.from(
        document.querySelectorAll('[role="combobox"]'),
      )
      return (
        comboboxes.find(el => {
          const label = el
            .closest('.MuiFormControl-root')
            ?.querySelector('.MuiInputLabel-root, label')
          return label?.textContent?.toLowerCase().includes('isoform')
        }) ?? null
      )
    })
    const isoformEl = isoformSelect.asElement()
    if (!isoformEl) {
      throw new Error('Isoform combobox not found in MSA dialog')
    }

    const initialValue = await p.evaluate(
      el => (el as HTMLElement).textContent,
      isoformEl,
    )

    await isoformEl.click()
    await new Promise(r => setTimeout(r, 500))
    await saveScreenshot(p, getScreenshotPath('08-dropdown-open'))

    const options = await p.$$('[role="option"]')
    if (options.length <= 1) {
      throw new Error('Expected multiple isoform options in dropdown')
    }

    await options[1]!.click()
    await new Promise(r => setTimeout(r, 1000))
    await saveScreenshot(p, getScreenshotPath('09-selection-changed'))

    const newValue = await p.evaluate(
      el => (el as HTMLElement).textContent,
      isoformEl,
    )
    expect(newValue).not.toBe(initialValue)

    // Verify selection persists (regression: useEffect was resetting it)
    await new Promise(r => setTimeout(r, 2000))
    const finalValue = await p.evaluate(
      el => (el as HTMLElement).textContent,
      isoformEl,
    )
    expect(finalValue).toBe(newValue)

    await saveScreenshot(
      p,
      getScreenshotPath('10-transcript-selection-verified'),
    )

    // Switch to manual upload tab to submit without external API calls
    const tabs = await p.$$('[role="tab"]')
    for (const tab of tabs) {
      const tabText = await p.evaluate(
        el => (el as HTMLElement).textContent,
        tab,
      )
      if (tabText?.toLowerCase().includes('manual')) {
        await tab.click()
        break
      }
    }
    await new Promise(r => setTimeout(r, 1000))

    const pasteLabel = await p.evaluateHandle(() => {
      const labels = Array.from(document.querySelectorAll('label'))
      return (
        labels.find(l => l.textContent?.toLowerCase().includes('paste')) ?? null
      )
    })
    const pasteLabelEl = pasteLabel.asElement()
    if (pasteLabelEl) {
      await pasteLabelEl.click()
    }
    await new Promise(r => setTimeout(r, 500))

    const msaTextarea = await p.$('textarea[name="MSA"]')
    if (!msaTextarea) {
      throw new Error('MSA textarea not found on manual upload tab')
    }
    await msaTextarea.click()
    await p.keyboard.type('>human\nACGTACGTACGT\n>mouse\nACGTACGTACGT\n')
    await new Promise(r => setTimeout(r, 500))
    await saveScreenshot(p, getScreenshotPath('10b-manual-upload-tab'))

    const submitHandle = await p.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons.find(b => b.textContent?.trim() === 'Submit') ?? null
    })
    const submitEl = submitHandle.asElement()
    if (!submitEl) {
      throw new Error('Submit button not found')
    }
    await submitEl.click()

    await p.waitForFunction(() => !document.querySelector('[role="dialog"]'), {
      timeout: 10_000,
    })

    await new Promise(r => setTimeout(r, 3000))
    await saveScreenshot(p, getScreenshotPath('11-final-success'))
  }, 240_000)
})
