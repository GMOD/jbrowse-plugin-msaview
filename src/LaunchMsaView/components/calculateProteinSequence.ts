import { dedupe, revcom } from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'

import { getGeneticCode, parseTranslTable } from './geneticCodes'

import type { Feat } from './types'
import type { Feature } from '@jbrowse/core/util'

// `@jbrowse/core/util/convertCodingSequenceToPeptides` is a deep path, so unlike
// the `@jbrowse/core/util` barrel it is absent from ReExports and gets bundled
// rather than resolved out of the host's JBrowseExports. That is what makes
// reusing core's translation safe across every host a config names: this module
// previously built its codon table at module scope from the barrel's
// `defaultCodonTable`, and a core build that dropped that export turned it into
// `Object.keys(undefined)` while the UMD was still evaluating -- the plugin
// global was never assigned and PluginLoader error-paged the whole app.

export function calculateProteinSequence({
  cds,
  sequence,
  geneticCodeId,
}: {
  cds: Feat[]
  sequence: string
  geneticCodeId?: number
}) {
  // `starts` is deliberately not passed: @jbrowse/core 4.3.0's signature has no
  // such parameter, so alternative initiators (GTG under table 11, ATA under
  // table 2) render as their internal residue rather than M. Core main added it;
  // pass it here when msaview's @jbrowse/core floor reaches that release.
  const { codonTable } = getGeneticCode(geneticCodeId)
  return convertCodingSequenceToPeptides({
    cds,
    sequence,
    codonTable,
  })
}

export function revlist(list: Feat[], seqlen: number) {
  return list
    .map(sub => ({
      ...sub,
      start: seqlen - sub.end,
      end: seqlen - sub.start,
    }))
    .toSorted((a, b) => a.start - b.start)
}

export function getProteinSequenceFromFeature({
  feature,
  seq,
}: {
  seq: string
  feature: Feature
}) {
  const { subfeatures, start, strand } = feature.toJSON()
  const cds = dedupe(
    subfeatures
      ?.toSorted((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - start,
        end: sub.end - start,
      }))
      .filter(subfeature => subfeature.type === 'CDS') ?? [],
    feat => `${feat.start}-${feat.end}`,
  )

  // a mitochondrial gene declares e.g. transl_table=2, so it translates with
  // NCBI table 2 rather than the standard code. GFF3 usually carries the
  // attribute on the CDS rather than the transcript, so check both.
  const cdsSubfeature = feature
    .get('subfeatures')
    ?.find((f: Feature) => f.get('type')?.toLowerCase() === 'cds')
  const geneticCodeId =
    parseTranslTable(feature.get('transl_table')) ??
    parseTranslTable(cdsSubfeature?.get('transl_table'))

  return calculateProteinSequence({
    cds: strand === -1 ? revlist(cds, seq.length) : cds,
    sequence: strand === -1 ? revcom(seq) : seq,
    geneticCodeId,
  })
}
