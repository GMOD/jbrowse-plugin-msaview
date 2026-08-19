#!/usr/bin/env node
/* global process, console, fetch, AbortSignal */
/* eslint-disable no-console */
// Every value the BLAST panel offers is validated by EBI, not by us: a database
// or tool name outside their list comes back as a 400 from `/run` at submit
// time, after the user has picked a transcript and pressed go. Nothing else in
// CI can see it -- the strings are well-typed, the bundle builds, the host-compat
// probe never submits a job -- so 3.0.0 shipped `uniprotkb_reference_proteomes`,
// a menu entry that had never worked and that EBI has no database for.
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
  msaAlgorithms,
} from '../src/LaunchMsaView/components/BlastQuery/consts.ts'

const EBI_BASE = 'https://www.ebi.ac.uk/Tools/services/rest'
const BLAST_TOOL = 'ncbiblast'

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

const acceptedDatabases = await fetchAcceptedValues(BLAST_TOOL, 'database')
for (const database of blastDatabaseOptions) {
  if (!acceptedDatabases.has(database)) {
    const nearest = suggest(database, acceptedDatabases)
    problems.push(
      `${BLAST_TOOL} rejects database "${database}"` +
        (nearest.length > 0
          ? `; closest EBI offers: ${nearest.join(', ')}`
          : ''),
    )
  }
}

// The alignment step submits to a service per algorithm, so a name that is not
// a tool is a 400 from a different endpoint than the BLAST one.
await Promise.all(
  msaAlgorithms.map(async tool => {
    try {
      await fetchWithRetry(`${EBI_BASE}/${tool}/parameters`)
    } catch (e) {
      problems.push(
        `msa algorithm "${tool}" is not an EBI service: ${e.message}`,
      )
    }
  }),
)

if (problems.length > 0) {
  console.error('Values the plugin offers that EBI will not accept:\n')
  for (const problem of problems) {
    console.error(`  ${problem}`)
  }
  console.error(
    `\nEBI's own lists are at ${EBI_BASE}/${BLAST_TOOL}/parameterdetails/<parameter>.`,
  )
  process.exit(1)
}

console.log(
  `EBI accepts all ${blastDatabaseOptions.length} databases and ${msaAlgorithms.length} alignment tools the plugin offers.`,
)
