import { afterEach, expect, test, vi } from 'vitest'

import { EUTILS_SPACING_MS, decodeXmlEntities, eutilsText } from './eutils'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('decodes the escapes GenPept and taxonomy XML carry', () => {
  expect(decodeXmlEntities('5&apos;-3&apos; exonuclease')).toBe(
    "5'-3' exonuclease",
  )
  expect(decodeXmlEntities('A &amp; B &lt;C&gt; &quot;D&quot;')).toBe(
    'A & B <C> "D"',
  )
  expect(decodeXmlEntities('&#39;&#x41;&unknown;')).toBe("'A&unknown;")
})

// a burst over three a second comes back without CORS headers, which the
// browser reports as a CORS failure for an endpoint that sends ACAO: *
test('concurrent eutils requests go out spaced under the rate limit', async () => {
  vi.useFakeTimers()
  const sentAt: number[] = []
  vi.stubGlobal('fetch', () => {
    sentAt.push(Date.now())
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    })
  })
  const all = Promise.all([eutilsText('a'), eutilsText('b'), eutilsText('c')])
  await vi.advanceTimersByTimeAsync(3 * EUTILS_SPACING_MS)
  await all
  expect(sentAt).toHaveLength(3)
  expect(sentAt[1]! - sentAt[0]!).toBeGreaterThanOrEqual(EUTILS_SPACING_MS)
  expect(sentAt[2]! - sentAt[1]!).toBeGreaterThanOrEqual(EUTILS_SPACING_MS)
})
