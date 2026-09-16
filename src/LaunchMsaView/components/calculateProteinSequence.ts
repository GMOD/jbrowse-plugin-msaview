import { revcom } from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import {
  getGeneticCode,
  parseTranslTable,
} from '@jbrowse/core/util/geneticCodes'

import type { Feat } from './types'
import type { Feature } from '@jbrowse/core/util'

// `@jbrowse/core/util/convertCodingSequenceToPeptides` and
// `@jbrowse/core/util/geneticCodes` are deep paths, so unlike the
// `@jbrowse/core/util` barrel they are absent from ReExports and get bundled
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

// The CDS list is sorted by start, so adjacent comparison is the whole job.
function cdsId(feat: Feat) {
  return `${feat.start}-${feat.end}`
}

function dedupe(list: Feat[]) {
  return list.filter(
    (item, pos, ary) => !pos || cdsId(item) !== cdsId(ary[pos - 1]!),
  )
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
  assemblyGeneticCodeId,
}: {
  seq: string
  feature: Feature
  /** the assembly's code for the feature's contig, `{ chrM: 2 }` in hub
   * configs; a transl_table on the feature wins */
  assemblyGeneticCodeId?: number
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
  )

  // RefSeq declares transl_table=2 on a mitochondrial CDS, usually on the CDS
  // rather than the transcript. GENCODE and UCSC declare nothing, so without
  // the assembly's code all 13 human mitochondrial proteins read TGA as a stop
  // and ATA as I.
  const cdsSubfeature = feature
    .get('subfeatures')
    ?.find((f: Feature) => f.get('type')?.toLowerCase() === 'cds')
  const geneticCodeId =
    parseTranslTable(feature.get('transl_table')) ??
    parseTranslTable(cdsSubfeature?.get('transl_table')) ??
    assemblyGeneticCodeId

  return calculateProteinSequence({
    cds: strand === -1 ? revlist(cds, seq.length) : cds,
    sequence: strand === -1 ? revcom(seq) : seq,
    geneticCodeId,
  })
}
