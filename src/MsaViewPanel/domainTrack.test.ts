import { expect, test } from 'vitest'

import { domainTrackConf } from './domainTrack'

const domains = {
  features: [
    {
      name: 'Hb beta-like',
      accession: 'cd1',
      kind: 'domain' as const,
      regions: [
        { refName: 'chr11', start: 100, end: 107 },
        { refName: 'chr11', start: 200, end: 208 },
      ],
    },
    {
      name: 'heme binding site',
      accession: 'cd2',
      kind: 'site' as const,
      regions: [{ refName: 'chr11', start: 103, end: 107 }],
    },
  ],
  color: {
    field: 'accession' as const,
    domain: ['cd1', 'cd2'],
    range: ['#1b9e77', '#d95f02'],
    labels: ['Hb beta-like', 'heme binding site'],
  },
}

const conf = domainTrackConf({
  viewId: 'msa1',
  assemblyName: 'hg38',
  name: 'HBB domains (from the alignment)',
  strand: -1,
  domains,
})

test('one feature per domain, one subfeature per region, spanning them all', () => {
  const [first] = conf.adapter.features
  expect(conf.trackId).toBe('msaview-domains-msa1')
  expect(conf.adapter.features).toHaveLength(2)
  expect(first).toMatchObject({
    refName: 'chr11',
    start: 100,
    end: 208,
    strand: -1,
    name: 'Hb beta-like',
    accession: 'cd1',
  })
  expect(first!.subfeatures.map(s => [s.start, s.end])).toEqual([
    [100, 107],
    [200, 208],
  ])
})

test('the display paints through the domains color object and names each in the key', () => {
  expect(conf.displays[0]!.color).toEqual({
    field: 'accession',
    domain: ['cd1', 'cd2'],
    range: ['#1b9e77', '#d95f02'],
    labels: ['Hb beta-like', 'heme binding site'],
    title: 'Domains',
  })
})

test('a MAF view knows no strand, and the features carry none', () => {
  const unstranded = domainTrackConf({
    viewId: 'msa1',
    assemblyName: 'hg38',
    name: 'x',
    domains,
  })
  expect('strand' in unstranded.adapter.features[0]!).toBe(false)
})
