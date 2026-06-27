import { type ChildProcess, execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { launch } from 'puppeteer'

import { saveStableScreenshot } from '../scripts/pngSnapshot.mjs'

import type { Browser, Page } from 'puppeteer'

export const JBROWSE_PORT = 9876

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

export function setupJBrowse() {
  if (!fs.existsSync(TEST_JBROWSE_DIR)) {
    throw new Error(
      `JBrowse directory not found at ${TEST_JBROWSE_DIR}. Run "yarn test:setup" or "yarn test:setup:version ${JBROWSE_VERSION}" first.`,
    )
  }

  execSync('yarn build', {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 60_000,
  })

  const testConfig = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), 'test_data', 'config.json'),
      'utf8',
    ),
  )
  testConfig.plugins = [
    {
      name: 'MsaView',
      url: `http://localhost:${JBROWSE_PORT}/plugin/jbrowse-plugin-msaview.umd.production.min.js`,
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

export async function startJBrowseServer(): Promise<ChildProcess> {
  killProcessOnPort(JBROWSE_PORT)

  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['serve', '-p', String(JBROWSE_PORT), '-s', TEST_JBROWSE_DIR],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )

    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error('Server did not start within 30000ms'))
    }, 30_000)

    const onData = (data: Buffer) => {
      const match = /Accepting connections at http:\/\/localhost:(\d+)/.exec(
        data.toString(),
      )
      if (match) {
        const actualPort = Number.parseInt(match[1], 10)
        clearTimeout(timeout)
        if (actualPort !== JBROWSE_PORT) {
          proc.kill()
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
    if (proc.killed) {
      resolve()
      return
    }
    proc.on('close', () => {
      resolve()
    })
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL')
      }
      resolve()
    }, 5000)
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
    if (type === 'error' || type === 'warning') {
      console.log(`[browser ${type}] ${msg.text()}`)
    }
  })
  page.on('pageerror', err => {
    console.log(`[browser page error] ${err.message}`)
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
