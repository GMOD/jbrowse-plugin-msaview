#!/usr/bin/env node
/* global process, console */
/* eslint-disable no-console */
import { execSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const JBROWSE_VERSIONS = ['v3.7.0', 'v4.0.4']

function getTestDir(version) {
  return path.join(process.cwd(), `.test-jbrowse-${version}`)
}

function setupVersion(version) {
  const testDir = getTestDir(version)
  if (fs.existsSync(testDir)) {
    console.log(
      `JBrowse ${version} already exists at ${testDir}, skipping setup`,
    )
    return true
  }
  console.log(`Creating JBrowse ${version} at ${testDir}...`)
  try {
    execSync(`npx @jbrowse/cli create ${testDir} --tag ${version}`, {
      stdio: 'inherit',
    })
    return true
  } catch (error) {
    console.error(`Failed to create JBrowse ${version}:`, error.message)
    return false
  }
}

function runTestsForVersion(version) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Running tests against JBrowse ${version}`)
  console.log(`${'='.repeat(60)}\n`)

  const result = spawnSync('yarn', ['vitest', 'run'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TEST_JBROWSE_VERSION: version,
    },
  })

  return result.status === 0
}

function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === 'setup') {
    const version = args[1]
    if (version) {
      if (!setupVersion(version)) {
        process.exit(1)
      }
    } else {
      console.log('Setting up all JBrowse versions...')
      for (const v of JBROWSE_VERSIONS) {
        if (!setupVersion(v)) {
          process.exit(1)
        }
      }
    }
    return
  }

  if (command === 'run') {
    const version = args[1]
    if (version) {
      if (!runTestsForVersion(version)) {
        process.exit(1)
      }
    } else {
      let allPassed = true
      const results = []
      for (const v of JBROWSE_VERSIONS) {
        const testDir = getTestDir(v)
        if (!fs.existsSync(testDir)) {
          console.log(`\nJBrowse ${v} not found at ${testDir}`)
          console.log(`Run: yarn test:setup:version ${v}`)
          results.push({ version: v, passed: false, reason: 'not setup' })
          allPassed = false
          continue
        }
        const passed = runTestsForVersion(v)
        results.push({ version: v, passed })
        if (!passed) {
          allPassed = false
        }
      }
      console.log(`\n${'='.repeat(60)}`)
      console.log('Test Results Summary')
      console.log('='.repeat(60))
      for (const r of results) {
        const status = r.passed ? '✓ PASSED' : '✗ FAILED'
        const reason = r.reason ? ` (${r.reason})` : ''
        console.log(`  JBrowse ${r.version}: ${status}${reason}`)
      }
      console.log('')
      if (!allPassed) {
        process.exit(1)
      }
    }
    return
  }

  console.log(`
Usage: node scripts/test-versions.mjs <command> [version]

Commands:
  setup [version]  Create JBrowse test instance(s)
                   If version specified, creates only that version
                   Otherwise creates all versions: ${JBROWSE_VERSIONS.join(', ')}

  run [version]    Run tests against JBrowse version(s)
                   If version specified, runs only against that version
                   Otherwise runs against all versions

Examples:
  node scripts/test-versions.mjs setup           # Setup all versions
  node scripts/test-versions.mjs setup v3.7.0   # Setup only v3.7.0
  node scripts/test-versions.mjs run            # Test all versions
  node scripts/test-versions.mjs run v4.0.4     # Test only v4.0.4

Environment:
  TEST_JBROWSE_VERSION - Set to test against a specific version with vitest directly
`)
}

main()
