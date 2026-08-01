#!/usr/bin/env node
//
// Boots a candidate umd build on hosted JBrowse releases and fails if any of
// them cannot load it.
//
// `plugins[].url` is the only config field that can kill a whole session rather
// than one track: PluginLoader runs Promise.all over the plugin list, so a
// bundle that throws while evaluating never defines its global, the promise
// rejects, and every config naming it goes to the app's error page. The store
// uploads `latest/` with no-cache, so a publish is a live change to configs
// shipped months ago -- there is no staging step in which to notice.
//
// The two outages this exists to prevent were both invisible to tsc, eslint, and
// a url reachability check, and both obvious the moment the bundle was booted on
// a real host:
//   - @mui/material/SvgIcon resolved out of the host's JBrowseExports, where
//     released hosts (MUI 7) expose a shape without the createSvgIcon that
//     icons-material v9 calls
//   - defaultCodonTable disappeared from the host's @jbrowse/core/util barrel,
//     turning a module-scope generateCodonTable(defaultCodonTable) into
//     Object.keys(undefined)
//
// This asserts the catastrophic class only -- app boots, plugin global defined.
// It deliberately does not drive the MSA launch: that needs live alignment
// fetches, and a release gate that fails on a slow third party gets bypassed,
// which is worse than a narrower gate that is always trusted.
//
// Usage:
//   node scripts/host-compat-probe.mjs --bundle dist/<name>.umd.production.min.js
//   node scripts/host-compat-probe.mjs --bundle … --versions v4.0.0,main
//
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

import puppeteer from 'puppeteer'

// The oldest entry is the support floor: every host at or above it must load the
// bundle. `main` is included because it is where a core change lands first, so
// it is where a vanishing re-export shows up before any release carries it.
const DEFAULT_VERSIONS = ['v4.0.0', 'v4.3.0', 'latest', 'main']

// A real shipped config that names this plugin, rather than a fixture: the point
// is to reproduce what a user's url actually loads.
const CONFIG = 'https://jbrowse.org/ucsc/hg38/config.json'
const PLUGIN_NAME = 'MsaView'
const PLUGIN_GLOBAL = 'JBrowsePluginMsaView'
const PACKAGE_PATH = '/jbrowse-plugin-msaview/'

const { values } = parseArgs({
  options: {
    bundle: { type: 'string' },
    versions: { type: 'string' },
    timeout: { type: 'string', default: '90000' },
    json: { type: 'string' },
  },
})
if (!values.bundle) {
  throw new Error('--bundle <path to built umd> is required')
}
const versions = values.versions?.split(',') ?? DEFAULT_VERSIONS
const timeout = Number(values.timeout)
const bundle = fs.readFileSync(values.bundle, 'utf8')
const bundleDir = path.dirname(values.bundle)
const mainName = path.basename(values.bundle)

// Serves the whole local dist for the plugin's store path, not just the one
// file: a build that code-splits fetches sibling chunks by their own hashed
// names, and answering those with the main bundle produces a failure that looks
// like a host incompatibility but is a probe bug.
async function serveCandidate(page) {
  await page.setRequestInterception(true)
  page.on('request', req => {
    const url = req.url()
    const name = path.basename(new URL(url).pathname)
    const sibling = path.join(bundleDir, name)
    const isPluginAsset = url.includes(PACKAGE_PATH) && name.endsWith('.js')
    const body = !isPluginAsset
      ? undefined
      : name !== mainName && fs.existsSync(sibling)
        ? fs.readFileSync(sibling, 'utf8')
        : bundle
    if (body === undefined) {
      req.continue().catch(() => {})
    } else {
      req
        .respond({
          status: 200,
          contentType: 'application/javascript',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body,
        })
        .catch(() => {})
    }
  })
}

async function probeOne(browser, version) {
  const page = await browser.newPage()
  await serveCandidate(page)
  const consoleErrors = []
  page.on('console', m => {
    if (m.type() === 'error') {
      consoleErrors.push(m.text().slice(0, 300))
    }
  })
  page.on('pageerror', e => {
    consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`)
  })

  const result = { version, consoleErrors }
  try {
    const url = `https://jbrowse.org/code/jb2/${version}/?config=${encodeURIComponent(CONFIG)}`
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Readiness is the session global or the error page. Do NOT wait on markup:
    // the loading spinner is an svg, so an element-presence wait returns before
    // plugins have loaded and reads every host as broken.
    result.settled = await page
      .waitForFunction(
        () =>
          !!(window.JBrowseSession ?? window.__jbrowse_session) ||
          /JBrowse Error|Fatal error/.test(document.body.innerText),
        { timeout },
      )
      .then(() => true)
      .catch(() => false)

    result.appError = await page.evaluate(() => {
      const t = document.body.innerText
      return t.includes('JBrowse Error') || t.includes('Fatal error')
        ? t.split('\n').slice(0, 4).join(' | ').slice(0, 300)
        : undefined
    })

    result.globalDefined = await page.evaluate(
      name => name in window,
      PLUGIN_GLOBAL,
    )
  } catch (e) {
    result.threw = String(e).slice(0, 300)
  }
  await page.close()
  return result
}

function failure(r) {
  return r.appError
    ? `SESSION FAILED: ${r.appError}`
    : r.threw
      ? `probe threw: ${r.threw}`
      : r.settled
        ? r.globalDefined
          ? undefined
          : `${PLUGIN_GLOBAL} is undefined (the bundle threw while evaluating)`
        : 'never settled (no session and no error page)'
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=swiftshader'],
  defaultViewport: { width: 1400, height: 900 },
})

console.log(
  `serving ${values.bundle} as ${PLUGIN_NAME} to ${CONFIG}\n` +
    `hosts: ${versions.join(', ')}\n`,
)

const results = []
for (const version of versions) {
  const r = await probeOne(browser, version)
  results.push(r)
  const bad = failure(r)
  console.log(`${version.padEnd(10)} ${bad ?? 'ok'}`)
  if (bad) {
    for (const e of [...new Set(r.consoleErrors)].slice(0, 4)) {
      console.log(`           · ${e}`)
    }
  }
}
await browser.close()

if (values.json) {
  fs.writeFileSync(values.json, JSON.stringify(results, null, 2))
}

const broken = results.filter(r => failure(r)).map(r => r.version)
if (broken.length > 0) {
  console.error(`\nFailed to load on: ${broken.join(', ')}`)
  process.exit(1)
}
console.log('\nAll probed hosts loaded the bundle.')
