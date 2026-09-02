import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { getAllCachedResults, saveBlastResult } from './blastCache'

import type { CachedBlastResult } from './blastCache'

// An in-memory stand-in for the one object store this module opens. Only the
// idb calls blastCache makes are implemented; anything else would be untested
// scaffolding.
const { rows } = vi.hoisted(() => ({
  rows: new Map<string, { id: string; timestamp: number }>(),
}))

vi.mock('./idb', () => ({
  createDbOpener: () => () =>
    Promise.resolve({
      put: (_store: string, value: { id: string }) => {
        rows.set(value.id, value as { id: string; timestamp: number })
        return Promise.resolve(value.id)
      },
      count: () => Promise.resolve(rows.size),
      getAll: () => Promise.resolve([...rows.values()]),
      transaction: () => ({
        store: {
          delete: (id: string) => {
            rows.delete(id)
            return Promise.resolve()
          },
        },
        done: Promise.resolve(),
      }),
    }),
}))

function save(n: number) {
  return saveBlastResult({
    proteinSequence: `SEQ${n}`,
    blastDatabase: 'uniprotkb_swissprot',
    msaAlgorithm: 'clustalo',
    msa: '>a\nMK',
    tree: '(a);',
    treeMetadata: '{}',
    rid: `job-${n}`,
  })
}

beforeEach(() => {
  rows.clear()
  // strictly increasing, so "oldest" is unambiguous -- 55 saves in one
  // millisecond would otherwise all carry the same timestamp
  let clock = 1
  vi.spyOn(Date, 'now').mockImplementation(() => clock++)
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('a store at the cap loses nothing', async () => {
  for (let i = 0; i < 50; i++) {
    await save(i)
  }
  expect(rows.size).toBe(50)
})

// Every row holds a whole alignment and its tree, so an unbounded store grows
// until the browser refuses writes to it and the user never learns why.
test('going over the cap drops the oldest results and keeps the newest 50', async () => {
  for (let i = 0; i < 55; i++) {
    await save(i)
  }
  expect(rows.size).toBe(50)
  const rids = (await getAllCachedResults()).map(
    (r: CachedBlastResult) => r.rid,
  )
  expect(rids.at(0)).toBe('job-54')
  expect(rids.at(-1)).toBe('job-5')
})

test('re-saving the same query overwrites its row rather than growing the store', async () => {
  for (let i = 0; i < 50; i++) {
    await save(i)
  }
  await save(0)
  expect(rows.size).toBe(50)
})
