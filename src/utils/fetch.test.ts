import { afterEach, expect, test, vi } from 'vitest'

import { HttpError, textfetch } from './fetch'

afterEach(() => {
  vi.unstubAllGlobals()
})

const failWith = (status: number, body: string) => {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(body, { status })))
}

const ids = Array.from({ length: 200 }, (_, i) => `NP_${100000 + i}.1`)

test('an HTTP error names the host and path, not a batched query string', async () => {
  failWith(429, 'Too Many Requests')
  const request = textfetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=protein&id=${ids.join(',')}`,
  )
  await expect(request).rejects.toBeInstanceOf(HttpError)
  await expect(request).rejects.toMatchObject({
    status: 429,
    message:
      'HTTP 429 fetching https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi Too Many Requests',
  })
})

test('an HTTP error trims ids carried in the path', async () => {
  failWith(500, 'oops')
  await expect(
    textfetch(
      `https://api.ncbi.nlm.nih.gov/datasets/v2/gene/id/${ids.join(',')}/product_report`,
    ),
  ).rejects.toThrow(
    /^HTTP 500 fetching https:\/\/api\.ncbi\.nlm\.nih\.gov\/datasets\/v2\/gene\/id\/NP_\S{0,80}\.\.\. oops$/,
  )
})
