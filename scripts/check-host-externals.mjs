#!/usr/bin/env node
/* global process, console */
/* eslint-disable no-console */
// Every bare import the bundle did NOT bundle resolves through the host's
// `JBrowseExports` map at runtime, and a key the host does not have is
// `undefined` -- which throws while the bundle evaluates, or, for a component,
// React error #130 the first time that code path renders.
//
// esbuild.mjs externalizes only the intersection of this build's
// @jbrowse/core ReExports list with the oldest supported host's
// (scripts/host-reexports-floor.json). This checks the built artifact rather
// than the intent: what actually binds to the host is what the bundle says.
import fs from 'node:fs'
import path from 'node:path'

import floor from './host-reexports-floor.json' with { type: 'json' }

const bundlePath =
  process.argv[2] ?? 'dist/jbrowse-plugin-msaview.umd.production.min.js'
if (!fs.existsSync(bundlePath)) {
  console.error(`No bundle at ${bundlePath} -- run pnpm build first`)
  process.exit(1)
}

const bundle = fs.readFileSync(bundlePath, 'utf8')
// a key that is a valid identifier (`react`, `mobx`) minifies to dot access,
// the rest stay bracketed
const bound = new Set(
  [
    ...bundle.matchAll(/JBrowseExports\[\s*"([^"]+)"\s*\]/g),
    ...bundle.matchAll(/JBrowseExports\.([A-Za-z_$][\w$]*)/g),
  ].map(m => m[1]),
)
// esbuild.mjs maps this one onto the host's older key on purpose
bound.delete('mobx-state-tree')

const floorPaths = new Set(floor.paths)
const newer = [...bound].filter(x => !floorPaths.has(x))
if (newer.length > 0) {
  console.error(
    `${path.basename(bundlePath)} binds ${newer.length} path(s) that @jbrowse/core@${floor.version} does not re-export:`,
  )
  for (const name of newer) {
    console.error(`  ${name}`)
  }
  console.error(
    'Those are undefined on the oldest supported host. Bundle them instead.',
  )
  process.exit(1)
}

console.log(
  `${bound.size} host-bound import(s), all re-exported by @jbrowse/core@${floor.version}`,
)
