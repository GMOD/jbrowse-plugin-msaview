import { SimpleFeature } from '@jbrowse/core/util'
import { describe, expect, test } from 'vitest'

import { isGeneLikeType, launchTarget } from './launchTarget'

import type { Feature } from '@jbrowse/core/util'

function feature(type: string, subfeatures: string[] = ['CDS']) {
  return new SimpleFeature({
    uniqueId: type,
    refName: 'chr1',
    start: 0,
    end: 100,
    type,
    subfeatures: subfeatures.map((t, i) => ({
      uniqueId: `${type}-${i}`,
      refName: 'chr1',
      start: 0,
      end: 100,
      type: t,
    })),
  })
}

const modernHost = (type: string | undefined) => ({
  contextMenuItems: () => [],
  contextMenuInfo: { item: { featureId: 'f1', type }, displayedRegionIndex: 0 },
  fetchFullFeature: (featureId: string) =>
    Promise.resolve(feature(`fetched:${featureId}`)),
})

const legacyHost = (feat: Feature) => ({
  contextMenuItems: () => [],
  contextMenuFeature: feat,
})

async function fetched(target: ReturnType<typeof launchTarget>) {
  return target && 'fetchFeature' in target
    ? await target.fetchFeature()
    : undefined
}

describe('isGeneLikeType', () => {
  test.each(['gene', 'mRNA', 'transcript', 'lnc_RNA', 'protein_coding_gene'])(
    'accepts %s',
    type => {
      expect(isGeneLikeType(type)).toBe(true)
    },
  )

  test.each(['CDS', 'exon', 'match', 'SNV', undefined, null, 42])(
    'rejects %s',
    type => {
      expect(isGeneLikeType(type)).toBe(false)
    },
  )
})

describe('launchTarget', () => {
  test('resolves the clicked feature through fetchFullFeature', async () => {
    const target = launchTarget(modernHost('mRNA'))
    expect(await fetched(target)).toBeDefined()
    expect((await fetched(target))?.get('type')).toBe('fetched:f1')
  })

  test('offers nothing for a non-gene click', () => {
    expect(launchTarget(modernHost('CDS'))).toBeUndefined()
    expect(launchTarget(modernHost(undefined))).toBeUndefined()
  })

  test('offers nothing when nothing was clicked', () => {
    expect(launchTarget({ contextMenuItems: () => [] })).toBeUndefined()
  })

  // v3.7.0 hosts have contextMenuFeature and nothing else; dropping this
  // fallback once took "Launch MSA view" off every host in the wild.
  test('falls back to a synchronous contextMenuFeature', () => {
    const target = launchTarget(legacyHost(feature('mRNA')))
    expect(target && 'feature' in target && target.feature.get('type')).toBe(
      'mRNA',
    )
  })

  test('applies the same gene test on both host shapes', () => {
    expect(launchTarget(legacyHost(feature('lnc_RNA')))).toBeDefined()
    expect(launchTarget(legacyHost(feature('exon')))).toBeUndefined()
  })

  // gene-like is not enough: an lncRNA translates to nothing, and offering the
  // item opened a dialog whose Submit never left grey
  test('declines a gene-like feature with no CDS below it', () => {
    expect(
      launchTarget(legacyHost(feature('lnc_RNA', ['exon']))),
    ).toBeUndefined()
  })

  // a legacy host can hand over a bare record whose children are a separate
  // query, and declining it takes the item off an ordinary gene with no word
  test('offers the item for a gene that arrived with no subfeatures', () => {
    expect(launchTarget(legacyHost(feature('gene', [])))).toBeDefined()
  })

  // a click on an isoform should open the dialog on the gene, so every
  // transcript is there to pick from
  test('climbs to the gene from a clicked isoform', () => {
    const gene = new SimpleFeature({
      uniqueId: 'gene',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'gene',
      subfeatures: [
        {
          uniqueId: 'mrna',
          refName: 'chr1',
          start: 0,
          end: 100,
          type: 'mRNA',
          subfeatures: [
            {
              uniqueId: 'cds',
              refName: 'chr1',
              start: 0,
              end: 100,
              type: 'CDS',
            },
          ],
        },
      ],
    })
    const mrna = gene.get('subfeatures')![0]!
    const target = launchTarget(legacyHost(mrna))
    expect(target && 'feature' in target && target.feature).toBe(gene)
    // the gene is what the dialog opens on, but the picker still opens on the
    // isoform the click landed on -- on a v4 host that click is the only place
    // the choice is ever stated
    expect(target?.preferredTranscriptId).toBe(mrna.id())
  })

  // a host that has both shapes must not fall through to the legacy branch and
  // launch on a stale feature when the click was not on a gene
  test('a non-gene click on a host carrying both shapes offers nothing', () => {
    expect(
      launchTarget({
        ...modernHost('CDS'),
        ...legacyHost(feature('mRNA')),
      }),
    ).toBeUndefined()
  })
})
