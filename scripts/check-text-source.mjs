#!/usr/bin/env node
/* global process, console */
/* eslint-disable no-console */
// A raw NUL byte in a source file makes git classify it as binary, and every
// tool a review reaches for then goes quiet about it: `git diff` prints
// `Bin 0 -> 4265 bytes` where the code should be, `git grep` answers "Binary
// file matches", plain grep finds nothing. tsc, eslint and prettier all stay
// green, so nothing else says a word.
//
// 2.10.1 shipped `src/utils/useFetch.ts` that way -- 4265 bytes of new code
// through a release with no reviewable diff -- because the cache-key separator
// was typed as the character instead of the escape.
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const files = execSync('git ls-files -z src', { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean)

const binary = files.filter(f => fs.readFileSync(f).includes(0))

if (binary.length > 0) {
  console.error('Source files git will treat as binary (they contain a NUL):')
  for (const f of binary) {
    console.error(`  ${f}`)
  }
  console.error('\nWrite the escape rather than the literal character.')
  process.exit(1)
}
