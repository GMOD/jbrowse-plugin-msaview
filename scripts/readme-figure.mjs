#!/usr/bin/env node
//
// Recaptures each README gallery figure from the demo link it wraps, with the
// local build standing in for the published plugin, so a figure shows the
// current UI and the demo it advertises.
//
// The `version` lifecycle runs this, so every release refreshes the figures.
// saveStableScreenshot leaves an image byte-identical unless the capture moved
// past its tolerance, so a release with no visible change commits nothing.
//
// Usage:
//   node scripts/readme-figure.mjs
//   node scripts/readme-figure.mjs --host main --only genome-link
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
      default: 'dist/jbrowse-plugin-msaview.esm.js',
    },
    host: { type: 'string' },
    only: { type: 'string' },
    timeout: { type: 'string', default: '120000' },
  },
})
const timeout = Number(values.timeout)

const readme = fs.readFileSync('README.md', 'utf8')
const figures = [
  ...readme.matchAll(
    /<a href="(https:\/\/jbrowse\.org\/code\/jb2\/[^"]*session=spec-[^"]*)"><img src="(docs\/gallery\/[\w-]+\.png)"/g,
  ),
]
  .map(([, link, out]) => ({ out, link: link.replaceAll('&amp;', '&') }))
  .filter(f => !values.only || f.out.includes(values.only))
if (figures.length === 0) {
  throw new Error('README.md has no gallery figure matching the filter')
}

// A pointer position to hover before the capture, so the genome view shows the
// codon under it. The viewport is fixed, so this is the R248 column.
const hoverAt = { 'docs/gallery/genome-link.png': { x: 819, y: 662 } }

// The ProteinView belongs to jbrowse-plugin-protein3d, and molstar gets no
// WebGL context in headless Chrome, so a figure is the genome view and the
// alignment.
function captureUrl(demo) {
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
  return `${host}session=spec-${specParam}`
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--use-gl=swiftshader'],
  defaultViewport: { width: 1180, height: 1000 },
})

async function capture({ out, link }) {
  const page = await browser.newPage()
  try {
    await candidateServer(values.bundle)(page)
    page.on('pageerror', e => {
      console.log(`[page error] ${String(e).slice(0, 300)}`)
    })
    await page.goto(captureUrl(link), {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })
    try {
      await page.waitForFunction(
        () => {
          const msa = window.JBrowseSession?.views.find(
            v => v.type === 'MsaView',
          )
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
      throw new Error(`${out}: the MSA never finished loading: ${state}`, {
        cause: e,
      })
    }
    // tracks and canvases paint after the model settles
    await page
      .waitForNetworkIdle({ idleTime: 2000, timeout })
      .catch(() => undefined)
    await new Promise(r => setTimeout(r, 5000))

    const spot = hoverAt[out]
    if (spot) {
      await page.mouse.move(spot.x, spot.y)
      await new Promise(r => setTimeout(r, 1500))
    }

    const appError = await page.evaluate(() =>
      /JBrowse Error|Fatal error/.test(document.body.innerText),
    )
    if (appError) {
      throw new Error(`${out}: the demo error-paged; not replacing the figure`)
    }

    // views keep their own heights, so the frame ends where the last one does
    const { width, height } = page.viewport()
    const viewsBottom = await page.evaluate(() =>
      Math.max(
        0,
        ...[
          ...document.querySelectorAll('[data-testid^="view-container-"]'),
        ].map(el => el.getBoundingClientRect().bottom),
      ),
    )
    const clip = {
      x: 0,
      y: 0,
      width,
      height: viewsBottom
        ? Math.min(height, Math.ceil(viewsBottom) + 8)
        : height,
    }
    const { written, ratio } = saveStableScreenshot(
      await page.screenshot({ clip, captureBeyondViewport: false }),
      out,
    )
    console.log(
      written
        ? `${out} refreshed`
        : `${out} unchanged (${((ratio ?? 0) * 100).toFixed(2)}% diff)`,
    )
  } finally {
    await page.close()
  }
}

try {
  for (const figure of figures) {
    await capture(figure)
  }
} finally {
  await browser.close()
}
