import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { build } from 'esbuild'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { launchBrowser } from './setup'

import type { Browser } from 'puppeteer'

// jsdom has no layout engine -- every rect it reports is zero -- so the one
// question this file asks (does the option squeeze the buttons?) cannot be
// asked there. It bundles the real component into a bare page and measures it
// in the browser puppeteer already brings, rather than standing up jbrowse and
// clicking through to the launch dialog to look at one row.
const STUB = `
export function getSession() {
  return { setUseWorkspaces() {}, setPendingMove() {} }
}
`

const ENTRY = (component: string) => `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { Dialog, DialogContent } from '@mui/material'
import SubmitCancelActions from '${component}'

createRoot(document.getElementById('root')).render(
  React.createElement(Dialog, { open: true, maxWidth: 'xl', fullWidth: true },
    React.createElement(DialogContent, null, 'panel'),
    React.createElement(SubmitCancelActions, {
      model: {},
      onSubmit: () => {},
      onCancel: () => {},
    }),
  ),
)
`

let browser: Browser
let pageUrl: string
let dir: string

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msaview-layout-'))
  fs.writeFileSync(path.join(dir, 'coreStub.js'), STUB)
  fs.writeFileSync(
    path.join(dir, 'entry.js'),
    ENTRY(
      path.join(
        process.cwd(),
        'src/LaunchMsaView/components/SubmitCancelActions',
      ),
    ),
  )
  await build({
    entryPoints: [path.join(dir, 'entry.js')],
    bundle: true,
    outfile: path.join(dir, 'bundle.js'),
    nodePaths: [path.join(process.cwd(), 'node_modules')],
    define: { 'process.env.NODE_ENV': '"development"' },
    alias: { '@jbrowse/core/util': path.join(dir, 'coreStub.js') },
  })
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><body style="margin:0"><div id="root"></div><script src="bundle.js"></script>',
  )
  pageUrl = `file://${path.join(dir, 'index.html')}`
  browser = await launchBrowser()
}, 120_000)

afterAll(async () => {
  await browser?.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function measure(width: number) {
  const page = await browser.newPage()
  await page.setViewport({ width, height: 400 })
  await page.goto(pageUrl, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.MuiDialogActions-root button')
  const measured = await page.evaluate(() => {
    const row = document.querySelector('.MuiDialogActions-root')!
    const rowRect = row.getBoundingClientRect()
    const buttons = [...row.querySelectorAll('button')].map(b => {
      const r = b.getBoundingClientRect()
      return {
        width: Math.round(r.width),
        right: r.right,
        top: Math.round(r.top),
      }
    })
    return {
      widths: buttons.map(b => b.width),
      overflowsRight: buttons.some(b => b.right > rowRect.right + 1),
      buttonsShareARow: new Set(buttons.map(b => b.top)).size === 1,
      hasToggle: !!row.querySelector('input[type="checkbox"]'),
    }
  })
  await page.close()
  return measured
}

// 520 and below is where the option used to shrink Submit from 87px to 67 and
// wrap its label onto a second line
test('the option never costs the buttons their size or their row', async () => {
  const wide = await measure(1100)
  expect(wide.hasToggle).toBe(true)
  expect(wide.buttonsShareARow).toBe(true)
  expect(wide.overflowsRight).toBe(false)

  for (const width of [700, 520, 400]) {
    const narrow = await measure(width)
    expect({ width, ...narrow }).toEqual({
      width,
      hasToggle: true,
      buttonsShareARow: true,
      overflowsRight: false,
      widths: wide.widths,
    })
  }
}, 120_000)
