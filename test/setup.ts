import { execSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import puppeteer, { type Browser, type Page } from 'puppeteer'

export const JBROWSE_PORT = 9876
const TEST_JBROWSE_DIR = path.join(process.cwd(), '.test-jbrowse')

export async function waitForServer(
  port: number,
  pathToCheck = '/',
  timeout = 30000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${port}${pathToCheck}`, res => {
          if (res.statusCode === 200) {
            resolve()
          } else {
            reject(new Error(`Server returned ${res.statusCode}`))
          }
        })
        req.on('error', reject)
        req.setTimeout(1000, () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })
      })
      return
    } catch {
      await new Promise(r => setTimeout(r, 500))
    }
  }
  throw new Error(`Server on port ${port} did not start within ${timeout}ms`)
}

/**
 * Set up a local JBrowse instance for testing.
 * Assumes `jbrowse create .test-jbrowse` was already run by the pretest script.
 */
export async function setupJBrowse(): Promise<void> {
  console.log('Setting up JBrowse test instance...')

  if (!fs.existsSync(TEST_JBROWSE_DIR)) {
    throw new Error(
      `JBrowse directory not found at ${TEST_JBROWSE_DIR}. Run "yarn pretest" first.`,
    )
  }

  // Build the plugin
  console.log('Building plugin...')
  execSync('yarn build', {
    cwd: process.cwd(),
    stdio: 'inherit',
    timeout: 60000,
  })

  // Copy the distconfig.json to JBrowse directory as config.json
  console.log('Setting up config...')
  const testConfig = createTestConfig()
  fs.writeFileSync(
    path.join(TEST_JBROWSE_DIR, 'config.json'),
    JSON.stringify(testConfig, null, 2),
  )

  // Copy the plugin dist to JBrowse directory
  console.log('Copying plugin...')
  const pluginDir = path.join(TEST_JBROWSE_DIR, 'plugin')
  fs.mkdirSync(pluginDir, { recursive: true })
  fs.cpSync(path.join(process.cwd(), 'dist'), pluginDir, { recursive: true })

  console.log('JBrowse test instance ready!')
}

function createTestConfig() {
  return {
    plugins: [
      {
        name: 'MsaView',
        url: `http://localhost:${JBROWSE_PORT}/plugin/out.js`,
      },
    ],
    msa: {
      datasets: [
        {
          datasetId: 'ucsc_100way',
          name: 'UCSC 100-way',
          description:
            'The source data for these multiple sequence alignments is from <a href="https://hgdownload.soe.ucsc.edu/goldenPath/hg38/multiz100way/alignments/">knownCanonical.multiz100way.protAA.fa.gz</a>',
          adapter: {
            type: 'BgzipFastaMsaAdapter',
            uri: 'https://jbrowse.org/demos/knownCanonical.multiz100way.protAA.fa.gz',
          },
        },
      ],
    },
    assemblies: [
      {
        name: 'hg38',
        aliases: ['GRCh38'],
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'P6R5xbRqRr',
          adapter: {
            type: 'BgzipFastaAdapter',
            uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
          },
        },
        refNameAliases: {
          adapter: {
            type: 'RefNameAliasAdapter',
            uri: 'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
          },
        },
      },
    ],
    tracks: [
      {
        type: 'FeatureTrack',
        trackId: 'gencode.v44.annotation.sorted.gff3',
        name: 'GENCODE v44',
        category: ['Annotation'],
        adapter: {
          type: 'Gff3TabixAdapter',
          uri: 'https://jbrowse.org/demos/app/gencode.v44.annotation.sorted.gff3.gz',
        },
        assemblyNames: ['hg38'],
      },
    ],
    defaultSession: {
      name: 'Test session',
      views: [
        {
          type: 'LinearGenomeView',
          tracks: [
            {
              type: 'FeatureTrack',
              configuration: 'gencode.v44.annotation.sorted.gff3',
            },
          ],
        },
      ],
    },
  }
}

let jbrowseServer: ChildProcess | undefined

function killProcessOnPort(port: number): void {
  try {
    // Find and kill any process using the port
    execSync(`lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`, {
      stdio: 'ignore',
    })
    console.log(`Killed any existing process on port ${port}`)
  } catch {
    // Ignore errors - port might not be in use
  }
}

export async function startJBrowseServer(): Promise<ChildProcess> {
  console.log(`Starting JBrowse server on port ${JBROWSE_PORT}...`)

  // Kill any existing process on the port
  killProcessOnPort(JBROWSE_PORT)

  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx',
      ['serve', '-p', String(JBROWSE_PORT), '-s', TEST_JBROWSE_DIR],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )

    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error(`Server did not start within 30000ms`))
    }, 30000)

    const onData = (data: Buffer) => {
      const str = data.toString()
      console.log(`[jbrowse-server] ${str}`)

      // Extract port from message like "Accepting connections at http://localhost:9876"
      const match = str.match(/Accepting connections at http:\/\/localhost:(\d+)/)
      if (match) {
        const actualPort = parseInt(match[1], 10)
        console.log(`Server reported port: ${actualPort}, expected: ${JBROWSE_PORT}`)

        if (actualPort !== JBROWSE_PORT) {
          clearTimeout(timeout)
          proc.kill()
          reject(
            new Error(
              `Server started on wrong port ${actualPort}, expected ${JBROWSE_PORT}`,
            ),
          )
          return
        }

        clearTimeout(timeout)
        jbrowseServer = proc

        // Give server a moment to be fully ready, then resolve
        setTimeout(() => {
          console.log('JBrowse server started!')
          resolve(proc)
        }, 500)
      }
    }

    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)

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
    if (!proc || proc.killed) {
      resolve()
      return
    }
    proc.on('close', () => resolve())
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL')
      }
      resolve()
    }, 5000)
  })
}

export async function cleanupJBrowse(): Promise<void> {
  if (jbrowseServer) {
    await stopServer(jbrowseServer)
  }
  // Optionally remove the test directory
  // if (fs.existsSync(TEST_JBROWSE_DIR)) {
  //   fs.rmSync(TEST_JBROWSE_DIR, { recursive: true })
  // }
}

export async function launchBrowser(headless = true): Promise<Browser> {
  return puppeteer.launch({
    headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

export async function createJBrowsePage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 900 })

  // Enable console logging from the page
  page.on('console', msg => {
    const type = msg.type()
    if (type === 'error') {
      console.log(`[browser error] ${msg.text()}`)
    }
  })

  page.on('pageerror', err => {
    console.log(`[browser page error] ${err.message}`)
  })

  const jbrowseUrl = `http://localhost:${JBROWSE_PORT}/?loc=chr1:114,704,469-114,716,894&assembly=hg38`
  console.log(`Navigating to: ${jbrowseUrl}`)
  await page.goto(jbrowseUrl, { waitUntil: 'networkidle2', timeout: 60000 })

  return page
}

export async function waitForJBrowseLoad(page: Page): Promise<void> {
  // Wait for the main view container
  await page.waitForSelector('[data-testid="lgv"]', { timeout: 30000 })
  // Give some time for tracks to load
  await new Promise(r => setTimeout(r, 3000))
}

export async function waitForTrackLoad(page: Page): Promise<void> {
  // Wait for feature track to have rendered content
  await page.waitForSelector('canvas', { timeout: 30000 })
  // Wait for any loading indicators to disappear
  await new Promise(r => setTimeout(r, 5000))
}
