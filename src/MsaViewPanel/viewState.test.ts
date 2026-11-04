import { beforeEach, describe, expect, test, vi } from 'vitest'

import { doLaunchBlast } from './doLaunchBlast'
import { loadProteinDomains } from './loadProteinDomains'
import stateModelFactory from './model'

const lgv = {
  id: 'lgv1',
  initialized: true,
  showLoading: false,
  assemblyNames: [] as string[],
  tracks: [],
  displayedRegions: [],
}

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({
    views: [lgv],
    hovered: undefined,
    assemblyManager: { get: () => undefined },
  }),
}))
vi.mock('./doLaunchBlast', () => ({ doLaunchBlast: vi.fn() }))
vi.mock('./loadProteinDomains', () => ({ loadProteinDomains: vi.fn() }))
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(async () => {}),
  generateDataStoreId: vi.fn(),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(),
}))

const MSA = '>QUERY\nMKV-\n>mouse\nMKIL\n'

const HBB_LIKE = {
  uniqueId: 'tx1',
  name: 'TX-201',
  refName: 'chr11',
  strand: 1,
  start: 0,
  end: 9,
  subfeatures: [{ type: 'CDS', start: 0, end: 9, phase: 0 }],
}

const settle = () => new Promise(res => setTimeout(res, 0))

beforeEach(() => {
  vi.clearAllMocks()
  lgv.showLoading = false
  lgv.assemblyNames = []
  vi.mocked(doLaunchBlast).mockReturnValue(new Promise(() => {}))
  vi.mocked(loadProteinDomains).mockReturnValue(new Promise(() => {}))
})

describe('notices', () => {
  test('a query row the alignment lacks, on a linked view', () => {
    const model = stateModelFactory().create({
      type: 'MsaView',
      data: { msa: MSA },
      connectedViewId: 'lgv1',
      connectedFeature: HBB_LIKE,
      querySeqName: 'human',
    })
    expect(model.notices).toEqual([
      'No row is named "human", the query row, so the alignment is not linked to the genome',
    ])
  })

  test('no query-row notice for an alignment linked to nothing', () => {
    const model = stateModelFactory().create({
      type: 'MsaView',
      data: { msa: MSA },
      querySeqName: 'human',
    })
    expect(model.notices).toEqual([])
  })

  test('the warning chip shows and dismisses them with the load warnings', () => {
    const model = stateModelFactory().create({
      type: 'MsaView',
      data: { msa: MSA },
      connectedViewId: 'lgv1',
      connectedFeature: { ...HBB_LIKE, strand: 0 },
    })
    model.addWarning('3 of 40 hits have no species name')
    expect(model.warnings).toEqual([
      '3 of 40 hits have no species name',
      'The linked transcript is not mapped to the genome: its strand is 0, not 1 or -1',
    ])
    expect(model.notices).toEqual(model.warnings)

    model.clearWarnings()
    expect(model.notices).toEqual([])
  })
})

describe('the domain auto-load', () => {
  function accessionAlignment() {
    return stateModelFactory().create({
      type: 'MsaView',
      data: {
        msa: MSA,
        treeMetadata: JSON.stringify({
          QUERY: { Accession: 'NP_1' },
          mouse: { Accession: 'NP_2' },
        }),
      },
    })
  }

  test('holds the view loading until it settles', async () => {
    const model = accessionAlignment()
    expect(loadProteinDomains).toHaveBeenCalledTimes(1)
    expect(model.showLoading).toBe(true)
  })

  test('a failure is a notice and ends the loading', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(loadProteinDomains).mockRejectedValue(
      new Error('HTTP 429 fetching efetch'),
    )
    const model = accessionAlignment()
    await settle()
    expect(model.showLoading).toBe(false)
    expect(model.error).toBeUndefined()
    expect(model.notices).toEqual([
      'Protein domains did not load from NCBI: HTTP 429 fetching efetch',
    ])
  })

  test('a half failure is a notice beside the domains that loaded', async () => {
    vi.mocked(loadProteinDomains).mockResolvedValue(
      'Protein domains loaded for 1 of 2 proteins; NCBI failed on the rest: HTTP 429',
    )
    const model = accessionAlignment()
    await settle()
    expect(model.showLoading).toBe(false)
    expect(model.notices).toEqual([
      'Protein domains loaded for 1 of 2 proteins; NCBI failed on the rest: HTTP 429',
    ])
  })
})

describe('domainsOnGenome', () => {
  function domainsAsked() {
    const model = stateModelFactory().create({
      type: 'MsaView',
      data: { msa: MSA },
      connectedViewId: 'lgv1',
      connectedFeature: HBB_LIKE,
      domainsOnGenome: true,
    })
    model.setAnnotations([
      {
        id: 'QUERY',
        accession: 'cd1',
        name: 'P53',
        description: 'a domain',
        start: 1,
        end: 3,
      },
    ])
    return model
  }

  test('holds the view loading while the genome view it waits on loads', () => {
    lgv.showLoading = true
    const model = domainsAsked()
    expect(model.connectedDomains.features).toHaveLength(1)
    expect(model.domainsOnGenome).toBe(true)
    expect(model.showLoading).toBe(true)
  })

  test('does not hold it once that view has settled', () => {
    const model = domainsAsked()
    expect(model.domainsOnGenome).toBe(true)
    expect(model.showLoading).toBe(false)
  })
})
