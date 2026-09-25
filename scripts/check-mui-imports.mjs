#!/usr/bin/env node
/* global process, console */
/* eslint-disable no-console */
// `@mui/material` is in ReExports, so the bundle does not carry it -- every
// named import binds to whatever the host's `JBrowseExports["@mui/material"]`
// happens to hold. That map is a hand-listed set of ~112 names, not all of MUI,
// and a name missing from it is plain `undefined` at runtime: React error #130
// when rendered as a component, or a thrown TypeError when called.
//
// Nothing else sees this. tsc resolves against the installed @mui/material,
// where the export exists, and the host-compat probe never opens a panel.
// `StepContent` error-paged the launch dialog that way. react-msaview 8.3.0's
// `createFilterOptions` was worse: called at module scope, it threw while the
// bundle evaluated and error-paged the whole app.
//
// The second came from a dependency, so this reads every module esbuild bundled
// (from the build's meta.json), not just src/.
import fs from 'node:fs'

const MUI_REEXPORTS = 'node_modules/@jbrowse/core/esm/ReExports/MuiReExports.js'
const METAFILE = 'meta.json'

for (const file of [MUI_REEXPORTS, METAFILE]) {
  if (!fs.existsSync(file)) {
    console.error(
      `Cannot find ${file} -- run pnpm install and pnpm build first`,
    )
    process.exit(1)
  }
}

const source = fs.readFileSync(MUI_REEXPORTS, 'utf8')
// entries look like `    Stepper: lazy(() => import('@mui/material/Stepper')),`,
// or `    Typography,` for the eager ones core 5 serves unwrapped
const hostExports = new Set(
  [...source.matchAll(/^\s{4}(\w+)(?::|,$)/gm)].map(m => m[1]),
)
// modules.js adds these three on top of the lazy map
for (const extra of ['alpha', 'useTheme', 'createTheme']) {
  hostExports.add(extra)
}

// Known, and not fixable from here: react-msaview deep-imports core's
// CascadingMenuButton, which bundles core's Dialog by way of the menu help
// icon, and that Dialog renders ThemeProvider, which no released host serves.
// Its own ErrorBoundary catches the #130, so a help dialog shows an error rather
// than the app error-paging. jbrowse-components main re-exports it now.
const KNOWN = [
  { name: 'ThemeProvider', file: '@jbrowse/core/esm/ui/Dialog.js' },
]

const { inputs } = JSON.parse(fs.readFileSync(METAFILE, 'utf8'))
const files = Object.entries(inputs)
  .filter(([, { imports }]) =>
    imports.some(i => i.path === 'global-externals:@mui/material'),
  )
  .map(([file]) => file)

const problems = []
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(
    /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]@mui\/material['"]/g,
  )) {
    if (match[1]) {
      continue
    }
    for (const raw of match[2].split(',')) {
      const name = raw
        .trim()
        .split(/\s+as\s+/)[0]
        ?.trim()
      if (
        name &&
        !name.startsWith('type ') &&
        !hostExports.has(name) &&
        !KNOWN.some(k => k.name === name && file.endsWith(k.file))
      ) {
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
    `\nThe host's list is ${MUI_REEXPORTS}. Either use a name that is on it,` +
      '\nor import the deep path (@mui/material/Thing), which esbuild bundles instead.',
  )
  process.exit(1)
}

console.log(
  `All @mui/material imports in ${files.length} bundled modules are on the host's re-export map (${hostExports.size} names).`,
)
