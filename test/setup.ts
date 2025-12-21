import { execSync, spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import puppeteer, { type Browser, type Page } from 'puppeteer'

export const JBROWSE_PORT = 9000
export const PLUGIN_PORT = 9001
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
 * Set up a local JBrowse instance for testing
 */
export async function setupJBrowse(): Promise<void> {
  console.log('Setting up JBrowse test instance...')

  // Remove old test directory if exists
  if (fs.existsSync(TEST_JBROWSE_DIR)) {
    console.log('Removing existing test JBrowse directory...')
    fs.rmSync(TEST_JBROWSE_DIR, { recursive: true })
  }

  // Create JBrowse instance
  console.log('Creating JBrowse instance...')
  execSync(`jbrowse create ${TEST_JBROWSE_DIR}`, {
    stdio: 'inherit',
    timeout: 120000,
  })

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

export async function startJBrowseServer(): Promise<ChildProcess> {
  console.log(`Starting JBrowse server on port ${JBROWSE_PORT}...`)

  // Use npx serve or python http.server to serve the JBrowse directory
  const proc = spawn('npx', ['serve', '-l', String(JBROWSE_PORT), '-s'], {
    cwd: TEST_JBROWSE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  })

  proc.stdout?.on('data', data => {
    console.log(`[jbrowse-server] ${data}`)
  })

  proc.stderr?.on('data', data => {
    // serve outputs to stderr
    const str = data.toString()
    if (!str.includes('Accepting connections')) {
      console.log(`[jbrowse-server] ${str}`)
    }
  })

  await waitForServer(JBROWSE_PORT, '/index.html')
  jbrowseServer = proc
  console.log('JBrowse server started!')
  return proc
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
