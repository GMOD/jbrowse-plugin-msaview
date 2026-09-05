#!/usr/bin/env node
/* global process, console, fetch, AbortSignal */
/* eslint-disable no-console */
// Every value the search panel offers is validated by EBI, not by us: a
// database or tool name outside their list comes back as a 400 from `/run` at
// submit time, after the user has picked a transcript and pressed go. Nothing
// else in CI can see it -- the strings are well-typed, the bundle builds, the
// host-compat probe never submits a job -- so 3.0.0 shipped
// `uniprotkb_reference_proteomes`, a menu entry that had never worked and that
// EBI has no database for.
//
// This reads the same constants the plugin ships and asks EBI what it accepts.
// It runs on push, so a value we invent is caught before release, and daily, so
// one EBI retires under us is caught while our own code sits still.
//
// A network failure is a failure, not a skip. An unreachable Job Dispatcher
// means the panel is dead for everyone regardless of which database they pick,
// and that is worth a red build too.
import {
  blastDatabaseOptions,
  ebiMsaAlgorithms,
  phmmerDatabaseOptions,
} from '../src/LaunchMsaView/components/BlastQuery/consts.ts'

const EBI_BASE = 'https://www.ebi.ac.uk/Tools/services/rest'

// Each search program has its own catalogue and its own names for the same
// data: `uniprotkb_swissprot` at ncbiblast is `swissprot` at phmmer, so neither
// list can stand in for the other.
const SEARCH_TOOLS = [
  { tool: 'ncbiblast', databases: blastDatabaseOptions },
  { tool: 'hmmer3_phmmer', databases: phmmerDatabaseOptions },
]

// Tools the plugin submits to that take no database: an aligner per EBI msa
// algorithm. The in-browser aligner is no service, and trees are built in the
// browser too.
const PLAIN_TOOLS = [...ebiMsaAlgorithms]

// EBI drops the occasional request, and one blip should not turn a push red
// when the check is about the shape of their catalogue rather than its uptime.
// A sustained outage still fails, which is the signal we want.
async function fetchWithRetry(url, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000 * i))
    }
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(`${url}: ${lastError.message}`)
}

async function fetchAcceptedValues(tool, parameter) {
  const response = await fetchWithRetry(
    `${EBI_BASE}/${tool}/parameterdetails/${parameter}`,
  )
  const { values } = await response.json()
  return new Set(values.values.map(v => v.value))
}

// Levenshtein would be overkill for a wrong guess like
// `uniprotkb_reference_proteomes`, whose closest real neighbours share whole
// underscore-separated words rather than a handful of characters. Rarer words
// carry the signal: two thirds of the catalogue starts `uniprotkb`, so matching
// it means nothing, while sharing `proteomes` narrows the field to a handful --
// which is what floats `pan_proteomes` to the top for the value that prompted
// this script.
function suggest(missing, accepted) {
  const frequency = new Map()
  for (const value of accepted) {
    for (const word of new Set(value.split('_'))) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1)
    }
  }
  const words = new Set(missing.split('_'))
  return [...accepted]
    .map(value => ({
      value,
      score: [...new Set(value.split('_'))]
        .filter(w => words.has(w))
        .reduce((sum, w) => sum + 1 / frequency.get(w), 0),
    }))
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(c => c.value)
}

const problems = []

let databaseCount = 0
for (const { tool, databases } of SEARCH_TOOLS) {
  const accepted = await fetchAcceptedValues(tool, 'database')
  databaseCount += databases.length
  for (const database of databases) {
    if (!accepted.has(database)) {
      const nearest = suggest(database, accepted)
      problems.push(
        `${tool} rejects database "${database}"` +
          (nearest.length > 0
            ? `; closest EBI offers: ${nearest.join(', ')}`
            : ''),
      )
    }
  }
}

// These are submitted to by name, so a name that is not a service is a 400 from
// a different endpoint than the database one.
await Promise.all(
  PLAIN_TOOLS.map(async tool => {
    try {
      await fetchWithRetry(`${EBI_BASE}/${tool}/parameters`)
    } catch (e) {
      problems.push(`"${tool}" is not an EBI service: ${e.message}`)
    }
  }),
)

if (problems.length > 0) {
  console.error('Values the plugin offers that EBI will not accept:\n')
  for (const problem of problems) {
    console.error(`  ${problem}`)
  }
  console.error(
    `\nEBI's own lists are at ${EBI_BASE}/<tool>/parameterdetails/<parameter>.`,
  )
  process.exit(1)
}

console.log(
  `EBI accepts all ${databaseCount} databases and ${PLAIN_TOOLS.length} alignment and tree tools the plugin offers.`,
)
