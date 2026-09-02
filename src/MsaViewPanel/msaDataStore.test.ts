import { beforeEach, expect, test, vi } from 'vitest'

import { retrieveMsaData } from './msaDataStore'

// An in-memory stand-in for the one object store this module opens, with a
// switch for the write half so a browser that refuses writes can be played back.
const { rows, state } = vi.hoisted(() => ({
  rows: new Map<string, { id: string; msa?: string; timestamp: number }>(),
  state: { putFails: false },
}))

vi.mock('../utils/idb', () => ({
  createDbOpener: () => () =>
    Promise.resolve({
      get: (_store: string, id: string) => Promise.resolve(rows.get(id)),
      put: (_store: string, value: { id: string; timestamp: number }) => {
        if (state.putFails) {
          return Promise.reject(new Error('QuotaExceededError'))
        }
        rows.set(value.id, value)
        return Promise.resolve(value.id)
      },
    }),
}))

beforeEach(() => {
  rows.clear()
  state.putFails = false
})

// cleanupOldData deletes by timestamp, so without this a session opened every
// single day still lost its alignment on the eighth
test('reading a row refreshes its timestamp, making the expiry "unused for 7 days"', async () => {
  rows.set('msa-1', { id: 'msa-1', msa: '>a\nMK', timestamp: 1000 })
  const before = Date.now()

  expect((await retrieveMsaData('msa-1'))?.msa).toBe('>a\nMK')
  expect(rows.get('msa-1')!.timestamp).toBeGreaterThanOrEqual(before)
})

test('a row that is no longer there reads as undefined and writes nothing', async () => {
  expect(await retrieveMsaData('msa-gone')).toBeUndefined()
  expect(rows.size).toBe(0)
})

// the refresh is housekeeping; failing it must not turn a readable alignment
// into a missing one, which is what the caller reports as expired
test('a refresh that fails still hands back the data it read', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  rows.set('msa-1', { id: 'msa-1', msa: '>a\nMK', timestamp: 1000 })
  state.putFails = true

  expect((await retrieveMsaData('msa-1'))?.msa).toBe('>a\nMK')
})
