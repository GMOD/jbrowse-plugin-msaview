import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import {
  MAX_AGE_MS,
  MAX_CACHED_SEARCHES,
  getCachedSearch,
  saveSearch,
  searchKey,
} from './searchCache'

const { rows } = vi.hoisted(() => ({
  rows: new Map<string, { id: string; timestamp: number }>(),
}))

vi.mock('./idb', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  createDbOpener: () => () =>
    Promise.resolve({
      get: (_store: string, id: string) => Promise.resolve(rows.get(id)),
      put: (_store: string, value: { id: string; timestamp: number }) => {
        rows.set(value.id, value)
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

function save(id: string) {
  return saveSearch({ id, fasta: `>${id}\nMK`, treeMetadata: {}, rid: id })
}

beforeEach(() => {
  rows.clear()
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
})

afterEach(() => {
  vi.useRealTimers()
})

test('a saved search reads back under its key', async () => {
  await save('a')
  expect((await getCachedSearch('a'))?.fasta).toBe('>a\nMK')
})

test('an unknown key is a miss', async () => {
  await save('a')
  expect(await getCachedSearch('b')).toBeUndefined()
})

test('a search older than seven days is a miss, so a relaunch searches afresh', async () => {
  await save('a')
  vi.setSystemTime(1_000_000 + MAX_AGE_MS - 1)
  expect(await getCachedSearch('a')).toBeDefined()
  vi.setSystemTime(1_000_000 + MAX_AGE_MS)
  expect(await getCachedSearch('a')).toBeUndefined()
})

test('the store keeps the newest searches and evicts the oldest', async () => {
  for (let i = 0; i < MAX_CACHED_SEARCHES + 3; i++) {
    vi.setSystemTime(1_000_000 + i)
    await save(`s${i}`)
  }
  expect(rows.size).toBe(MAX_CACHED_SEARCHES)
  expect(await getCachedSearch('s0')).toBeUndefined()
  expect(await getCachedSearch('s2')).toBeUndefined()
  expect(await getCachedSearch('s3')).toBeDefined()
  expect(await getCachedSearch(`s${MAX_CACHED_SEARCHES + 2}`)).toBeDefined()
})

test('the key separates every input that changes the hits', () => {
  const base = {
    searchProgram: 'blastp',
    database: 'uniprotkb_swissprot',
    maxHits: 100,
    querySeqName: 'QUERY',
    query: 'MKWV',
  }
  const keys = new Set([
    searchKey(base),
    searchKey({ ...base, database: 'uniprotkb_trembl' }),
    searchKey({ ...base, maxHits: 50 }),
    searchKey({ ...base, querySeqName: 'P53_HUMAN_query' }),
    searchKey({ ...base, query: 'MKWVT' }),
  ])
  expect(keys.size).toBe(5)
})
