import { beforeEach, describe, expect, test, vi } from 'vitest'

import { bestEffort, createDbOpener } from './idb'

import type { OpenDBCallbacks } from 'idb'

interface FakeOpen {
  callbacks: OpenDBCallbacks<unknown>
  resolve: (db: { close: () => void }) => void
  reject: (e: unknown) => void
}

const { opens } = vi.hoisted(() => ({ opens: [] as FakeOpen[] }))

vi.mock('idb', () => ({
  openDB: (
    _name: string,
    _version: number,
    callbacks: OpenDBCallbacks<unknown>,
  ) =>
    new Promise((resolve, reject) => {
      opens.push({ callbacks, resolve, reject })
    }),
}))

function fakeDb() {
  return { close: vi.fn() }
}

beforeEach(() => {
  opens.length = 0
})

describe('createDbOpener', () => {
  test('shares one connection between callers', async () => {
    const getDB = createDbOpener('db', 1, () => {})
    const first = getDB()
    const second = getDB()
    const db = fakeDb()
    opens[0]!.resolve(db)
    expect(await first).toBe(db)
    expect(await second).toBe(db)
    expect(opens.length).toBe(1)
  })

  test('a failed open is retried by the next caller', async () => {
    const getDB = createDbOpener('db', 1, () => {})
    const first = getDB()
    opens[0]!.reject(new Error('private mode'))
    await expect(first).rejects.toThrow('private mode')
    void getDB()
    expect(opens.length).toBe(2)
  })

  test('an open blocked by another tab rejects instead of waiting on it', async () => {
    const getDB = createDbOpener('db', 2, () => {})
    const first = getDB()
    opens[0]!.callbacks.blocked!(1, 2, {} as IDBVersionChangeEvent)
    await expect(first).rejects.toThrow(/held open at version 1/)

    // the upgrade goes through once the other tab lets go, and the connection
    // nobody is waiting for any more is closed rather than leaked
    const late = fakeDb()
    opens[0]!.resolve(late)
    await Promise.resolve()
    expect(late.close).toHaveBeenCalled()
  })

  test('a connection blocking another tab closes and is reopened on next use', async () => {
    const getDB = createDbOpener('db', 1, () => {})
    const pending = getDB()
    const db = fakeDb()
    opens[0]!.resolve(db)
    await pending
    const target = { close: vi.fn() }
    opens[0]!.callbacks.blocking!(1, 2, {
      target,
    } as unknown as IDBVersionChangeEvent)
    expect(target.close).toHaveBeenCalled()
    void getDB()
    expect(opens.length).toBe(2)
  })

  test('a terminated connection is reopened on next use', async () => {
    const getDB = createDbOpener('db', 1, () => {})
    const pending = getDB()
    opens[0]!.resolve(fakeDb())
    await pending
    opens[0]!.callbacks.terminated!()
    void getDB()
    expect(opens.length).toBe(2)
  })
})

describe('bestEffort', () => {
  test('answers the operation when it succeeds', async () => {
    expect(await bestEffort('read', () => Promise.resolve(3), 0)).toBe(3)
  })

  test('answers the fallback when it throws', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      await bestEffort('read', () => Promise.reject(new Error('quota')), 0),
    ).toBe(0)
  })
})
