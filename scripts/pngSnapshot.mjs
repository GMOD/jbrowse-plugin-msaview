// Stable screenshot writer shared by the vitest E2E suite (test/plugin.test.ts)
// and the docs smoke test (scripts/test-docs.mjs).
//
// puppeteer screenshots are not pixel-deterministic: antialiasing, WebGL/molstar
// rendering, and font hinting all wobble a little between runs. Writing them
// straight to disk meant every test run rewrote every committed PNG, so each
// commit churned the whole figure set even when nothing visibly changed.
//
// saveStableScreenshot normalizes the capture through `pngquant --nofs` (small,
// dither-free, byte-identical run-to-run) and then only overwrites the committed
// reference when it differs by more than a tolerance. Below the tolerance the
// existing file is left byte-for-byte intact, so git stays clean.

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

// Fraction of pixels allowed to differ before a screenshot counts as genuinely
// changed. Rendering noise sits well under this; a real UI change clears it.
const DEFAULT_DIFF_RATIO = Number(process.env.SCREENSHOT_DIFF_RATIO ?? '0.01')

// Per-pixel color tolerance handed to pixelmatch (0 = exact, 1 = anything goes).
const PIXEL_THRESHOLD = 0.1

// `--nofs` disables Floyd-Steinberg dithering: each pixel is quantized
// independently, so a minor input change stays local instead of rippling across
// the whole palette. Output is byte-identical run-to-run. Falls back to the raw
// PNG wherever pngquant is unavailable (e.g. a bare CI image).
function quantize(png) {
  try {
    return execSync('pngquant --nofs --strip 256 -', {
      input: png,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    })
  } catch {
    return png
  }
}

// Fraction of differing pixels, or undefined when the images aren't comparable
// (no prior file, or the dimensions changed — both of which force a write).
function diffRatio(prev, next) {
  const a = PNG.sync.read(prev)
  const b = PNG.sync.read(next)
  const comparable = a.width === b.width && a.height === b.height
  return comparable
    ? pixelmatch(a.data, b.data, null, a.width, a.height, {
        threshold: PIXEL_THRESHOLD,
      }) /
        (a.width * a.height)
    : undefined
}

// Write `pngBuffer` to `filePath` only if it differs meaningfully from what is
// already there. Returns { written, ratio } so callers can log the outcome.
export function saveStableScreenshot(
  pngBuffer,
  filePath,
  diffLimit = DEFAULT_DIFF_RATIO,
) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const next = quantize(Buffer.from(pngBuffer))
  const prev = fs.existsSync(filePath) ? fs.readFileSync(filePath) : undefined
  const ratio = prev ? diffRatio(prev, next) : undefined
  const name = path.basename(filePath)

  let written = true
  if (ratio !== undefined && ratio <= diffLimit) {
    written = false
    console.log(
      `screenshot ${name}: unchanged (${(ratio * 100).toFixed(2)}% diff), kept committed reference`,
    )
  } else if (ratio === undefined) {
    fs.writeFileSync(filePath, next)
    console.log(`screenshot ${name}: written (new or resized)`)
  } else {
    fs.writeFileSync(filePath, next)
    console.log(
      `screenshot ${name}: updated (${(ratio * 100).toFixed(2)}% diff)`,
    )
  }
  return { written, ratio }
}
