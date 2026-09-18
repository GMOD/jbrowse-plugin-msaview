#!/usr/bin/env node
//
// Recaptures the README's gallery figure from the README's own demo link, with
// the local build standing in for the published plugin. The figure then shows
// the current UI and the demo it advertises, rather than a session from 2021.
//
// The `version` lifecycle runs this, so every release refreshes the figure.
// saveStableScreenshot leaves img/1.png byte-identical unless the capture moved
// past its tolerance, so a release with no visible change commits nothing.
//
// Usage:
//   node scripts/readme-figure.mjs
//   node scripts/readme-figure.mjs --host v4.3.0 --out /tmp/figure.png
//
import fs from 'node:fs'
import { parseArgs } from 'node:util'

import puppeteer from 'puppeteer'

import { saveStableScreenshot } from './pngSnapshot.mjs'
import { candidateServer } from './serveCandidate.mjs'

const { values } = parseArgs({
  options: {
    bundle: {
      type: 'string',
      default: 'dist/jbrowse-plugin-msaview.umd.production.min.js',
    },
    host: { type: 'string' },
    out: { type: 'string', default: 'img/1.png' },
    timeout: { type: 'string', default: '120000' },
  },
})
const timeout = Number(values.timeout)

// The first `session=spec-` link in the README is the demo.
const readme = fs.readFileSync('README.md', 'utf8')
const demo =
  /\((https:\/\/jbrowse\.org\/code\/jb2\/[^)\s]*session=spec-[^)\s]*)\)/.exec(
    readme,
  )?.[1]
if (!demo) {
  throw new Error('README.md has no session=spec- demo link to capture')
}

// The ProteinView belongs to jbrowse-plugin-protein3d, and molstar gets no
// WebGL context in headless Chrome, so the figure is the genome view and the
// alignment.
const [base, specText] = demo.split('session=spec-')
const spec = JSON.parse(decodeURIComponent(specText))
spec.views = spec.views.filter(v => v.type !== 'ProteinView')
const host = values.host
  ? base.replace(/\/code\/jb2\/[^/]+\//, `/code/jb2/${values.host}/`)
  : base
// Escaping only what must be, as the README link does: the whole demo fully
// escaped is over the 8KB request header that jbrowse.org's S3 accepts.
const specParam = encodeURIComponent(JSON.stringify(spec)).replaceAll(
  /%(2C|3A|5B|5D|7B|7D)/g,
  decodeURIComponent,
)
const url = `${host}session=spec-${specParam}`

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=swiftshader'],
  defaultViewport: { width: 1600, height: 800 },
})
try {
  const page = await browser.newPage()
  await candidateServer(values.bundle)(page)
  page.on('pageerror', e => {
    console.log(`[page error] ${String(e).slice(0, 300)}`)
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  try {
    await page.waitForFunction(
      () => {
        const msa = window.JBrowseSession?.views.find(v => v.type === 'MsaView')
        return (
          !!msa?.dataInitialized &&
          !msa.isLoading &&
          (!msa.connectedTranscript || !!msa.connectedFeature)
        )
      },
      { timeout },
    )
  } catch (e) {
    const state = await page.evaluate(() =>
      JSON.stringify(
        window.JBrowseSession?.views.map(v => ({
          type: v.type,
          error: v.error ? String(v.error) : undefined,
          dataInitialized: v.dataInitialized,
          isLoading: v.isLoading,
          connectedFeature: v.connectedTranscript
            ? !!v.connectedFeature
            : undefined,
        })) ?? document.body.innerText.slice(0, 500),
      ),
    )
    throw new Error(`the MSA never finished loading: ${state}`, { cause: e })
  }
  // tracks and canvases paint after the model settles
  await page
    .waitForNetworkIdle({ idleTime: 2000, timeout })
    .catch(() => undefined)
  await new Promise(r => setTimeout(r, 5000))

  const appError = await page.evaluate(() =>
    /JBrowse Error|Fatal error/.test(document.body.innerText),
  )
  if (appError) {
    throw new Error('the demo session error-paged; not replacing the figure')
  }

  // views keep their own heights, so the frame ends where the last one does
  const { width, height } = page.viewport()
  const viewsBottom = await page.evaluate(() =>
    Math.max(
      0,
      ...[...document.querySelectorAll('[data-testid^="view-container-"]')].map(
        el => el.getBoundingClientRect().bottom,
      ),
    ),
  )
  const clip = {
    x: 0,
    y: 0,
    width,
    height: viewsBottom ? Math.min(height, Math.ceil(viewsBottom) + 8) : height,
  }
  const { written, ratio } = saveStableScreenshot(
    await page.screenshot({ clip, captureBeyondViewport: false }),
    values.out,
  )
  console.log(
    written
      ? `${values.out} refreshed`
      : `${values.out} unchanged (${((ratio ?? 0) * 100).toFixed(2)}% diff)`,
  )
} finally {
  await browser.close()
}
