#!/usr/bin/env node
/* global process, console */
/* eslint-disable no-console */
// `@mui/material` is in ReExports, so the bundle does not carry it -- every
// named import binds to whatever the host's `JBrowseExports["@mui/material"]`
// happens to hold. That map is a hand-listed set of ~112 components, not all of
// MUI, and a name missing from it is plain `undefined` at runtime. Rendered as a
// component that throws React error #130 and takes the whole dialog with it.
//
// Nothing else sees this. tsc resolves against the installed @mui/material,
// where the export exists; eslint has no opinion; the host-compat probe loads
// the bundle but never opens the panel, so an import that only evaluates on
// render stays invisible. `StepContent` reached a working build and a green
// probe that way, and error-paged the launch dialog on every host.
//
// So compare what src/ imports against what the host actually re-exports.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const MUI_REEXPORTS = 'node_modules/@jbrowse/core/esm/ReExports/MuiReExports.js'

if (!fs.existsSync(MUI_REEXPORTS)) {
  console.error(`Cannot find ${MUI_REEXPORTS} -- is @jbrowse/core installed?`)
  process.exit(1)
}

const source = fs.readFileSync(MUI_REEXPORTS, 'utf8')
// entries look like `    Stepper: lazy(() => import('@mui/material/Stepper')),`
const hostExports = new Set(
  [...source.matchAll(/^\s{4}(\w+):/gm)].map(m => m[1]),
)
// modules.js adds these three on top of the lazy map
for (const extra of ['alpha', 'useTheme', 'createTheme']) {
  hostExports.add(extra)
}

const files = execSync('git ls-files -z src', { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))

const problems = []
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(
    /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@mui\/material'/g,
  )) {
    // a type-only import never reaches the host's map at runtime
    const isTypeImport = match[0].includes('import type')
    if (isTypeImport) {
      continue
    }
    for (const raw of match[1].split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim()
      if (name && !name.startsWith('type ') && !hostExports.has(name)) {
        problems.push({ file, name })
      }
    }
  }
}

if (problems.length > 0) {
  console.error(
    "Imported from '@mui/material' but absent from the host's re-export map,\n" +
      'so it is undefined at runtime on every host:\n',
  )
  for (const { file, name } of problems) {
    console.error(`  ${name}  (${file})`)
  }
  console.error(
    `\nThe host's list is ${MUI_REEXPORTS}. Either use a component that is on it,` +
      '\nor import the deep path (@mui/material/Thing), which esbuild bundles instead.',
  )
  process.exit(1)
}

console.log(
  `All @mui/material imports in src/ are on the host's re-export map (${hostExports.size} names).`,
)
