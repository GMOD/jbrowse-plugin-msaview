import { type ChildProcess, execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { launch } from 'puppeteer'

import { saveStableScreenshot } from '../scripts/pngSnapshot.mjs'

import type { Browser, Page } from 'puppeteer'

export const JBROWSE_PORT = Number(process.env.JBROWSE_PORT ?? 9876)

const JBROWSE_VERSION = process.env.TEST_JBROWSE_VERSION ?? 'nightly'
const VERSION_SUFFIX =
  JBROWSE_VERSION === 'nightly' ? '' : `-${JBROWSE_VERSION}`
const TEST_JBROWSE_DIR = path.join(
  process.cwd(),
  `.test-jbrowse${VERSION_SUFFIX}`,
)
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots')

export function getTestJBrowseDir() {
  return TEST_JBROWSE_DIR
}

export function getJBrowseVersion() {
  return JBROWSE_VERSION
}

export function buildPlugin() {
  execSync('pnpm build', {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 60_000,
  })
}

export function setupJBrowse() {
  if (!fs.existsSync(TEST_JBROWSE_DIR)) {
    throw new Error(
      `JBrowse directory not found at ${TEST_JBROWSE_DIR}. Run "pnpm test:setup" or "pnpm test:setup:version ${JBROWSE_VERSION}" first.`,
    )
  }

  buildPlugin()

  const testConfig = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'test_data', 'config.json'),
      'utf8',
    ),
  )
  testConfig.plugins = [
    {
      name: 'MsaView',
      esmUrl: `http://localhost:${JBROWSE_PORT}/plugin/jbrowse-plugin-msaview.esm.js`,
    },
  ]
  fs.writeFileSync(
    path.join(TEST_JBROWSE_DIR, 'config.json'),
    JSON.stringify(testConfig, null, 2),
  )

  const pluginDir = path.join(TEST_JBROWSE_DIR, 'plugin')
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.cpSync(path.join(process.cwd(), 'dist'), pluginDir, { recursive: true })
}

function killProcessOnPort(port: number): void {
  try {
    execSync(`lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`, {
      stdio: 'ignore',
    })
  } catch {
    // port may not be in use
  }
}

// npx runs serve as a child of its own, so the signal goes to the group
function signalServer(proc: ChildProcess, signal: NodeJS.Signals) {
  if (proc.pid !== undefined) {
    try {
      process.kill(-proc.pid, signal)
    } catch {
      // the group has already exited
    }
  }
}

export async function startJBrowseServer(): Promise<ChildProcess> {
  killProcessOnPort(JBROWSE_PORT)

  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['serve', '-p', String(JBROWSE_PORT), '-s', TEST_JBROWSE_DIR],
      { stdio: ['ignore', 'pipe', 'pipe'], detached: true },
    )

    const timeout = setTimeout(() => {
      signalServer(proc, 'SIGTERM')
      reject(new Error('Server did not start within 30000ms'))
    }, 30_000)

    const onData = (data: Buffer) => {
      const portText = /Accepting connections at http:\/\/localhost:(\d+)/.exec(
        data.toString(),
      )?.[1]
      if (portText) {
        const actualPort = Number.parseInt(portText, 10)
        clearTimeout(timeout)
        if (actualPort !== JBROWSE_PORT) {
          signalServer(proc, 'SIGTERM')
          reject(
            new Error(
              `Server started on wrong port ${actualPort}, expected ${JBROWSE_PORT}`,
            ),
          )
          return
        }
        setTimeout(() => {
          resolve(proc)
        }, 500)
      }
    }

    proc.stdout.on('data', onData)
    proc.stderr.on('data', onData)

    proc.on('error', err => {
      clearTimeout(timeout)
      reject(err)
    })

    proc.on('exit', code => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout)
        reject(new Error(`Server exited with code ${code}`))
      }
    })
  })
}

export async function stopServer(proc: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    if (proc.exitCode === null && proc.signalCode === null) {
      proc.on('close', () => {
        resolve()
      })
      signalServer(proc, 'SIGTERM')
      setTimeout(() => {
        signalServer(proc, 'SIGKILL')
        resolve()
      }, 5000)
    } else {
      resolve()
    }
  })
}

export async function launchBrowser(headless = true): Promise<Browser> {
  return launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

export async function createJBrowsePage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  page.on('console', msg => {
    const type = msg.type()
    if (type === 'error' || type === 'warn') {
      console.log(`[browser ${type}] ${msg.text()}`)
    }
  })
  page.on('pageerror', err => {
    console.log(
      '[browser page error]',
      err instanceof Error ? err.message : err,
    )
  })
  page.on('requestfailed', request => {
    console.log(
      `[request failed] ${request.url()}: ${request.failure()?.errorText}`,
    )
  })

  await page.goto(`http://localhost:${JBROWSE_PORT}/`, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  })

  return page
}

// Capture `page` and persist it to `filePath`, overwriting the committed PNG
// only when it differs meaningfully from the existing one (see pngSnapshot.mjs).
export async function saveScreenshot(
  page: Page,
  filePath: string,
): Promise<void> {
  saveStableScreenshot(await page.screenshot(), filePath)
}

export interface MsaViewReport {
  loading: boolean
  error?: string
  notices: string[]
  source: { kind: string }
  rows: number
  columns: number
  domainAnnotations: number
  queryRow: { name: string; found: boolean; offset: number }
  connection?: { mapped: boolean; unmappedBecause?: string }
}

/**
 * jb.waitReady: the app's ready marker, which reads every view's
 * `showLoading` and every display's phase, held steady before it answers
 */
export async function waitReady(page: Page, timeoutMs = 90_000) {
  return page.evaluate(async (ms: number) => {
    interface JbApi {
      waitReady: (ms: number) => Promise<{ settled: boolean; note?: string }>
    }
    const jb: JbApi | undefined = Reflect.get(window, 'jb')
    return jb
      ? jb.waitReady(ms)
      : { settled: false, note: 'window.jb is absent on this host' }
  }, timeoutMs)
}

export async function readMsaReport(page: Page) {
  return page.evaluate(() => {
    interface Session {
      views: { type: string; report?: MsaViewReport }[]
    }
    const session: Session | undefined = Reflect.get(window, 'JBrowseSession')
    return session?.views.find(v => v.type === 'MsaView')?.report
  })
}

export async function waitForJBrowseLoad(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('#root')
      return root && root.children.length > 0
    },
    { timeout: 30_000 },
  )

  try {
    await page.waitForSelector('canvas', { timeout: 30_000 })
  } catch {
    await saveScreenshot(
      page,
      path.join(SCREENSHOT_DIR, `${JBROWSE_VERSION}-00-no-canvas.png`),
    )
  }

  await new Promise(r => setTimeout(r, 3000))
}

export async function findByText(
  page: Page,
  selector: string,
  matches: (text: string) => boolean,
) {
  const elements = await page.$$(selector)
  const texts = await Promise.all(
    elements.map(el => el.evaluate(e => e.textContent)),
  )
  return elements.find((_, i) => matches(texts[i] ?? ''))
}

/**
 * Click "MSA view..." in an open context menu's Launch submenu, which the
 * plugin shares with every other plugin's launch rows.
 */
export async function clickLaunchMsaView(page: Page): Promise<void> {
  const label = 'MSA view...'
  const rows = await page.$$('[role="menuitem"]')
  let launchRow
  for (const row of rows) {
    if ((await row.evaluate(el => el.textContent)) === 'Launch') {
      launchRow = row
    }
  }
  if (!launchRow) {
    throw new Error('no "Launch" submenu in the context menu')
  }
  await launchRow.hover()
  await page.waitForFunction(
    text =>
      [...document.querySelectorAll('[role="menuitem"]')].some(el =>
        el.textContent.includes(text),
      ),
    { timeout: 5000 },
    label,
  )
  for (const row of await page.$$('[role="menuitem"]')) {
    if ((await row.evaluate(el => el.textContent)).includes(label)) {
      await row.click()
      return
    }
  }
}
