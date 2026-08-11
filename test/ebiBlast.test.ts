import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, test, vi } from 'vitest'

import { normalizeEbiBlastHits } from '../src/utils/ebiBlast'
import {
  DEFAULT_EBI_EMAIL,
  EBI_EMAIL_STORAGE_KEY,
  getEbiEmail,
  waitForEbiJob,
} from '../src/utils/ebiJobDispatcher'

// A real https://www.ebi.ac.uk/Tools/services/rest/ncbiblast result, trimmed to
// three hits: two UniProtKB hits as returned, plus one carrying none of the
// hit_uni_* fields, which is what a non-UniProt database sends back. The field
// names are the whole risk in this mapping — nothing else in CI would notice if
// EBI renamed one.
const result = JSON.parse(
  readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      'fixtures',
      'ebi-ncbiblast-albumin.json',
    ),
    'utf8',
  ),
)

describe('normalizeEbiBlastHits', () => {
  test('maps a UniProtKB hit onto the shape the MSA rows are built from', () => {
    const [hit] = normalizeEbiBlastHits(result)

    expect(hit!.description[0]).toEqual({
      accession: 'P02769',
      id: 'ALBU_BOVIN',
      sciname: 'Bos taurus',
      taxid: 9913,
      title: 'Albumin',
    })
    expect(hit!.hsps[0]!.hseq).toMatch(/^MKWVTFISLL/)
  })

  test('parses hit_uni_ox, which arrives as a string', () => {
    // taxid feeds fetchTaxonomyInfo and the Map lookup in makeId, both of which
    // silently miss on a string
    for (const hit of normalizeEbiBlastHits(result).slice(0, 2)) {
      expect(typeof hit.description[0]!.taxid).toBe('number')
    }
    expect(normalizeEbiBlastHits(result)[1]!.description[0]!.taxid).toBe(9541)
  })

  test('falls back to the non-UniProt fields when hit_uni_* are absent', () => {
    const hit = normalizeEbiBlastHits(result)[2]!

    expect(hit.description[0]).toEqual({
      accession: 'CAA76847',
      id: 'CAA76847',
      sciname: 'Ovis aries',
      taxid: undefined,
      title: 'serum albumin',
    })
  })

  test('keeps gaps in hseq, which doLaunchBlast strips itself', () => {
    expect(normalizeEbiBlastHits(result)[2]!.hsps[0]!.hseq).toBe('MKWV-TFISLL')
  })

  test('tolerates a result with no hits', () => {
    expect(normalizeEbiBlastHits({})).toEqual([])
  })
})

describe('getEbiEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStorage(stored: string | null) {
    vi.stubGlobal('localStorage', {
      getItem: () => stored,
      setItem: () => {},
    })
  }

  test('falls back to the plugin address when nothing is configured', () => {
    stubStorage(null)
    expect(getEbiEmail()).toBe(DEFAULT_EBI_EMAIL)
  })

  test('uses a deployment-configured address', () => {
    stubStorage(JSON.stringify('someone@example.org'))
    expect(getEbiEmail()).toBe('someone@example.org')
  })

  test('falls back when the stored value is blank', () => {
    // EBI rejects a submission with an empty email, so a user who clears the
    // settings field must not be able to break every job
    stubStorage(JSON.stringify('   '))
    expect(getEbiEmail()).toBe(DEFAULT_EBI_EMAIL)
  })

  test('reads the key the settings dialog writes', () => {
    expect(EBI_EMAIL_STORAGE_KEY).toBe('msa-ebiContactEmail')
  })
})

describe('waitForEbiJob', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubStatuses(statuses: string[]) {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(`${statuses.shift() ?? 'FINISHED'}\n`)),
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  test('resolves on FINISHED', async () => {
    stubStatuses(['FINISHED'])
    await expect(
      waitForEbiJob({
        tool: 'ncbiblast',
        jobId: 'job-1',
        onCountdown: () => {},
      }),
    ).resolves.toBeUndefined()
  })

  test('throws on ERROR rather than polling forever', async () => {
    // the previous status check was `result.includes('FINISHED')`, so an errored
    // job never satisfied it and never failed either — it just spun
    stubStatuses(['ERROR'])
    await expect(
      waitForEbiJob({
        tool: 'ncbiblast',
        jobId: 'job-2',
        onCountdown: () => {},
      }),
    ).rejects.toThrow(/status ERROR/)
  })

  test('throws on NOT_FOUND, which is what an expired job id returns', async () => {
    stubStatuses(['NOT_FOUND'])
    await expect(
      waitForEbiJob({
        tool: 'ncbiblast',
        jobId: 'job-3',
        onCountdown: () => {},
      }),
    ).rejects.toThrow(/status NOT_FOUND/)
  })

  test('keeps waiting through RUNNING', async () => {
    const fetchMock = stubStatuses(['RUNNING', 'FINISHED'])
    await waitForEbiJob({
      tool: 'ncbiblast',
      jobId: 'job-4',
      intervalSeconds: 0,
      onCountdown: () => {},
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
