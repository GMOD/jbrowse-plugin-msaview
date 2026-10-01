#!/usr/bin/env node
//
// Boots a candidate build on hosted JBrowse and fails if it cannot load it.
//
// `plugins[].url` is the only config field that can kill a whole session rather
// than one track: a bundle that throws while evaluating takes every config
// naming it to the app's error page wherever the loader is all-or-nothing. The store
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
// This asserts the catastrophic class only -- app boots, plugin registered.
// It deliberately does not drive the MSA launch: that needs live alignment
// fetches, and a release gate that fails on a slow third party gets bypassed,
// which is worse than a narrower gate that is always trusted.
//
// Usage:
//   node scripts/host-compat-probe.mjs --bundle dist/jbrowse-plugin-msaview.esm.js
//
import fs from 'node:fs'
import { parseArgs } from 'node:util'

import puppeteer from 'puppeteer'

import { candidateServer } from './serveCandidate.mjs'

// The ESM build needs JBrowse 5, and `main` is the only hosted 5.x build until
// 5.0.0 is released. v4 hosts load the frozen 3.10.0 UMD from pinned urls.
const DEFAULT_VERSIONS = ['main']

// A real shipped config that names this plugin, rather than a fixture: the point
// is to reproduce what a user's url actually loads. It names the plugin by
// `storePlugin`, which main resolves through the store manifest that
// serveCandidate rewrites.
const CONFIG = 'https://jbrowse.org/ucsc/hg38/config.json'
const PLUGIN_NAME = 'MsaView'
const PLUGIN_CLASS_NAME = 'MsaViewPlugin'

const { values } = parseArgs({
  options: {
    bundle: { type: 'string' },
    versions: { type: 'string' },
    timeout: { type: 'string', default: '90000' },
    json: { type: 'string' },
  },
})
if (!values.bundle) {
  throw new Error('--bundle <path to the built ESM entry> is required')
}
const versions = values.versions?.split(',') ?? DEFAULT_VERSIONS
const timeout = Number(values.timeout)
const serveCandidate = candidateServer(values.bundle)

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
  const entryRequestsBefore = serveCandidate.entryRequests
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

    result.registered = await page.evaluate(
      name =>
        !!window.JBrowseRootModel?.pluginManager?.plugins?.some(
          p => p.name === name,
        ),
      PLUGIN_CLASS_NAME,
    )
    result.candidateServed = serveCandidate.entryRequests > entryRequestsBefore
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
        ? !r.candidateServed
          ? 'the host never requested the candidate entry (did the store ref resolve?)'
          : r.registered
            ? undefined
            : `${PLUGIN_CLASS_NAME} is not registered (the bundle threw while evaluating)`
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
