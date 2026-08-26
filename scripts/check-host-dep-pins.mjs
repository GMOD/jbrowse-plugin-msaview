#!/usr/bin/env node
/* global process, console */
/* eslint-disable no-console */
// mobx, mobx-react and @jbrowse/mobx-state-tree are in ReExports, so none of
// them ships in the bundle -- each one is a one-line shim that hands off to the
// host's `JBrowseExports[...]`. That makes the versions in package.json look
// free to bump: the browser gets the host's copy no matter what we declare.
//
// They are not free. The declared version is the API surface tsc checks the
// source against, standing in for a host we cannot see, so declaring a major
// the host does not serve turns tsc from a host-compatibility check into a
// rubber stamp -- the same shape as the `defaultCodonTable` and `SvgIcon`
// outages in CLAUDE.md, where a green build error-paged every released host.
//
// Locally it also forks the package in two, because @jbrowse/core keeps its own
// copy: a 2026-08 update to mst 6 / mobx 7 produced 9 `[$type]` type errors and
// `multiple, different versions of MobX active` under vitest.
//
// Rather than do range arithmetic, resolve each package from the plugin root
// and from @jbrowse/core and check both land on the same directory on disk.
// That states the actual requirement -- one shared copy -- and catches a second
// copy however it arrives, including via a transitive dep.
//
// typescript is a separate pin with the same "looks harmless" quality.
// TypeScript 7's package entry is a stub -- `require('typescript')` yields
// `{version, versionMajorMinor}` and nothing else -- so everything reading the
// compiler API through it breaks at once. Here that is typescript-eslint, which
// refuses to load and takes `pnpm lint` with it, and preversion runs lint.
// jbrowse-components hit the same wall across six packages and split the
// versions (see its scripts/check-typescript-pin.ts). The check reads
// typescript-eslint's own peer range, so it lifts itself once a release
// supports the newer compiler.
//
// Run: pnpm check-host-dep-pins
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const HOST_SUPPLIED = ['mobx', 'mobx-react', '@jbrowse/mobx-state-tree']

const root = process.cwd()
const fromPlugin = createRequire(path.join(root, 'package.json'))

// @jbrowse/core's "exports" map covers neither `.` nor `./package.json`, so
// require.resolve cannot reach it at all -- take it off disk by path
const corePackageJson = path.join(
  root,
  'node_modules/@jbrowse/core/package.json',
)
if (!fs.existsSync(corePackageJson)) {
  console.error(`Cannot find ${corePackageJson} -- run pnpm install first`)
  process.exit(1)
}
// Resolve through the real path, not pnpm's symlink: from the symlink, node
// walks up into the plugin's own node_modules and finds *our* copy of
// everything, which is exactly the confusion this script exists to detect
const fromCore = createRequire(fs.realpathSync(corePackageJson))

function packageDir(require, name) {
  // `./package.json` is the cheap path but plenty of packages omit it from
  // "exports", so fall back to walking up from the resolved entry point
  try {
    return path.dirname(require.resolve(`${name}/package.json`))
  } catch {
    let dir = path.dirname(require.resolve(name))
    while (!fs.existsSync(path.join(dir, 'package.json'))) {
      const parent = path.dirname(dir)
      if (parent === dir) {
        throw new Error(`no package.json above ${require.resolve(name)}`)
      }
      dir = parent
    }
    return dir
  }
}

function version(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    .version
}

const problems = []

for (const name of HOST_SUPPLIED) {
  let ours
  let theirs
  try {
    ours = packageDir(fromPlugin, name)
    theirs = packageDir(fromCore, name)
  } catch (error) {
    problems.push(`${name}: could not resolve -- ${error.message}`)
    continue
  }
  if (fs.realpathSync(ours) !== fs.realpathSync(theirs)) {
    problems.push(
      `${name}: we resolve ${version(ours)}, @jbrowse/core resolves ` +
        `${version(theirs)}. The host serves one copy, so these must agree -- ` +
        `match @jbrowse/core's range in package.json.`,
    )
  }
}

const tsEslintPeer = JSON.parse(
  fs.readFileSync(fromPlugin.resolve('typescript-eslint/package.json'), 'utf8'),
).peerDependencies?.typescript
const tsVersion = version(packageDir(fromPlugin, 'typescript'))

// typescript-eslint's range is `>=x.y.z <a.b.c`; only the upper bound has ever
// been the problem here, so that is the half worth checking
const parse = v => v.split('-')[0].split('.').map(Number)
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

const upperBound = /<\s*(\d+\.\d+\.\d+)/.exec(tsEslintPeer ?? '')?.[1]
if (
  upperBound !== undefined &&
  compare(parse(tsVersion), parse(upperBound)) >= 0
) {
  problems.push(
    `typescript ${tsVersion} is outside typescript-eslint's peer range ` +
      `"${tsEslintPeer}", so it will refuse to load and pnpm lint will fail. ` +
      `Hold typescript below ${upperBound} until typescript-eslint supports it.`,
  )
}

if (problems.length > 0) {
  console.error(problems.join('\n\n'))
  console.error('\nSee the header of scripts/check-host-dep-pins.mjs for why.')
  process.exit(1)
}

console.log(
  `${HOST_SUPPLIED.join(', ')} each resolve to one copy shared with ` +
    `@jbrowse/core, and typescript ${tsVersion} is within typescript-eslint's ` +
    `peer range.`,
)
