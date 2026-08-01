#!/usr/bin/env node
//
// Refuses to tag a release unless Integration is green on the exact commit being
// tagged.
//
// 2.7.0 deleted the pre-4.3 contextMenuFeature branch as "unreachable dead
// code". The v3.7.0 job in the test matrix caught it immediately and failed with
// `"Launch MSA view" not found in context menu` -- and 2.7.1 was tagged anyway,
// because nightly was red in the same run for an unrelated reason, so a true
// positive read as ambient noise. v3.7.0 hosts lost the menu item for a week.
//
// Every other preversion step checks the working tree. This is the only one that
// checks whether anything has actually run the tests on it.
//
// Escape hatch: ALLOW_RED_CI=1 pnpm version patch
//
/* global process, console */
/* eslint-disable no-console */
import { execFileSync } from 'node:child_process'

const WORKFLOW = 'Integration'

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function findProblem() {
  const sha = git('rev-parse', 'HEAD')
  const short = sha.slice(0, 7)

  // An unpushed commit has no run to look up, and its absence is
  // indistinguishable from "the run has not been created yet". Say which it is.
  const runs = !git('branch', '-r', '--contains', sha)
    ? undefined
    : JSON.parse(
        execFileSync(
          'gh',
          ['api', `repos/:owner/:repo/actions/runs?head_sha=${sha}`],
          { encoding: 'utf8' },
        ),
      ).workflow_runs.filter(r => r.name === WORKFLOW)

  const run = runs?.[0]
  return !runs
    ? `HEAD (${short}) is not pushed, so ${WORKFLOW} has never seen it. Push it, let the run finish, then bump.`
    : !run
      ? `no ${WORKFLOW} run exists for ${short}`
      : run.status !== 'completed'
        ? `${WORKFLOW} is still ${run.status} -- wait for it: ${run.html_url}`
        : run.conclusion !== 'success'
          ? `${WORKFLOW} concluded ${run.conclusion}: ${run.html_url}`
          : { ok: `${WORKFLOW} is green on ${short}: ${run.html_url}` }
}

if (process.env.ALLOW_RED_CI) {
  console.warn('ALLOW_RED_CI set -- skipping the green-CI release gate')
} else {
  const result = findProblem()
  if (typeof result === 'string') {
    console.error(
      `Refusing to release: ${result}\n\n` +
        'The store serves latest/ with no-cache, so this tag is a live change to\n' +
        'configs shipped months ago. If the failure is genuinely unrelated, rerun\n' +
        'with ALLOW_RED_CI=1 and say why in the release notes.',
    )
    process.exit(1)
  }
  console.log(result.ok)
}
