import { genomeToTranscriptSeqMapping } from 'g2p_mapper'
import { describe, expect, test } from 'vitest'

import { annotationKind, connectedDomains } from './connectedDomains'

import type { DomainSource } from './connectedDomains'
import type { Annotation } from 'react-msaview'

// five codons read from 207 down: 207-205, 204-202, 201-200 then 106 across
// the intron, 105-103, 102-100
const reverseTranscript = genomeToTranscriptSeqMapping({
  refName: 'chr1',
  strand: -1,
  start: 100,
  end: 208,
  subfeatures: [
    { refName: 'chr1', type: 'CDS', start: 100, end: 107, phase: 0 },
    { refName: 'chr1', type: 'CDS', start: 200, end: 208, phase: 0 },
  ],
})

function annotation(
  accession: string,
  start: number,
  end: number,
  id = 'QUERY',
): Annotation {
  return {
    id,
    accession,
    name: `name ${accession}`,
    description: '',
    start,
    end,
  }
}

function source(
  annotations: Annotation[],
  overrides: Partial<DomainSource> = {},
): DomainSource {
  return {
    showDomains: true,
    querySeqName: 'QUERY',
    transcriptToMsaMap: reverseTranscript,
    annotationsByRow: Object.groupBy(annotations, a => a.id) as Record<
      string,
      Annotation[]
    >,
    annotationTypes: new Map(
      annotations.map(a => [
        a.accession,
        { ...a, name: `legend ${a.accession}` },
      ]),
    ),
    featureColors: new Map(
      annotations.map(a => [a, { fill: `fill-${a.accession}` }]),
    ),
    ...overrides,
  }
}

describe('connectedDomains on a reverse-strand transcript', () => {
  test('a domain crossing the exon boundary is one region per exon piece', () => {
    expect(connectedDomains(source([annotation('site', 2, 4)]))).toEqual({
      features: [
        {
          name: 'legend site',
          accession: 'site',
          kind: 'domain',
          regions: [
            { refName: 'chr1', start: 103, end: 107 },
            { refName: 'chr1', start: 200, end: 205 },
          ],
        },
      ],
      color: {
        field: 'accession',
        scale: {
          domain: ['site'],
          range: ['fill-site'],
          names: ['legend site'],
        },
      },
    })
  })

  test('the longest comes first, in the features and the color domain alike', () => {
    const { features, color } = connectedDomains(
      source([annotation('site', 2, 4), annotation('domain', 1, 5)]),
    )
    expect(features.map(d => d.accession)).toEqual(['domain', 'site'])
    expect(color.scale.domain).toEqual(['domain', 'site'])
    expect(color.scale.range).toEqual(['fill-domain', 'fill-site'])
    expect(features[0]!.regions).toEqual([
      { refName: 'chr1', start: 100, end: 107 },
      { refName: 'chr1', start: 200, end: 208 },
    ])
  })

  test('a scattered site is one entry, its residues merged where they touch', () => {
    const { features } = connectedDomains(
      source([
        annotation('small', 4, 5),
        annotation('heme', 1, 1),
        annotation('heme', 3, 3),
        annotation('heme', 4, 4),
      ]),
    )
    expect(features.map(d => d.accession)).toEqual(['heme', 'small'])
    expect(features[0]).toEqual({
      name: 'legend heme',
      accession: 'heme',
      kind: 'domain',
      regions: [
        { refName: 'chr1', start: 103, end: 107 },
        { refName: 'chr1', start: 200, end: 202 },
        { refName: 'chr1', start: 205, end: 208 },
      ],
    })
  })

  test('a trimmed query row shifts by querySeqOffset', () => {
    const [domain] = connectedDomains(
      source([annotation('site', 1, 2)], { querySeqOffset: 1 }),
    ).features
    expect(domain!.regions).toEqual([
      { refName: 'chr1', start: 106, end: 107 },
      { refName: 'chr1', start: 200, end: 205 },
    ])
  })

  test('residues past the transcript drop out, and a domain with none left', () => {
    expect(
      connectedDomains(
        source([annotation('tail', 5, 9), annotation('off', 7, 9)]),
      ).features,
    ).toEqual([
      expect.objectContaining({
        accession: 'tail',
        regions: [{ refName: 'chr1', start: 100, end: 103 }],
      }),
    ])
  })

  test('only the query row, and nothing while the overlay is off', () => {
    const annotations = [annotation('other', 1, 5, 'Mouse')]
    expect(connectedDomains(source(annotations)).features).toEqual([])
    expect(
      connectedDomains(
        source([annotation('domain', 1, 5)], { showDomains: false }),
      ),
    ).toEqual({
      features: [],
      color: {
        field: 'accession',
        scale: { domain: [], range: [], names: [] },
      },
    })
  })
})

test('a MAF row maps one base per residue', () => {
  const [domain] = connectedDomains(
    source([annotation('d', 3, 6)], {
      transcriptToMsaMap: undefined,
      mafRegion: { refName: 'chr2', start: 50, end: 100, assemblyName: 'hg38' },
    }),
  ).features
  expect(domain!.regions).toEqual([{ refName: 'chr2', start: 52, end: 56 }])
})

test('an entry is a site when its featureType names one', () => {
  const { features } = connectedDomains(
    source([
      { ...annotation('heme', 2, 2), featureType: 'Site' },
      { ...annotation('globin', 1, 5), featureType: 'Region' },
      annotation('gff', 1, 4),
    ]),
  )
  expect(features.map(d => [d.accession, d.kind])).toEqual([
    ['globin', 'domain'],
    ['gff', 'domain'],
    ['heme', 'site'],
  ])
})

test.each([
  ['Site', 'site'],
  ['binding_site', 'site'],
  ['Active_site', 'site'],
  ['Conserved_site', 'site'],
  ['Binding site', 'site'],
  ['Region', 'domain'],
  ['protein_match', 'domain'],
  ['Domain', 'domain'],
  ['siteless', 'domain'],
  [undefined, 'domain'],
])('annotationKind(%s) is %s', (featureType, kind) => {
  expect(annotationKind(featureType)).toBe(kind)
})
