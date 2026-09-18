import { revcom } from '@jbrowse/core/util'
import { convertCodingSequenceToPeptides } from '@jbrowse/core/util/convertCodingSequenceToPeptides'
import {
  getGeneticCode,
  parseTranslTable,
  relativizeTranslExcept,
} from '@jbrowse/core/util/geneticCodes'

import type { Feat } from './types'
import type { Feature } from '@jbrowse/core/util'
import type { TranslExcept } from '@jbrowse/core/util/geneticCodes'

// `@jbrowse/core/util/convertCodingSequenceToPeptides` and
// `@jbrowse/core/util/geneticCodes` are deep paths absent from ReExports, so
// they are bundled rather than resolved out of the host's JBrowseExports: every
// host runs the version this build installs. Importing translation from the
// `@jbrowse/core/util` barrel instead is what error-paged the whole app when a
// core build dropped `defaultCodonTable`.

export function calculateProteinSequence({
  cds,
  sequence,
  geneticCodeId,
  translExcept,
}: {
  cds: Feat[]
  sequence: string
  geneticCodeId?: number
  translExcept?: TranslExcept[]
}) {
  const { codonTable, starts } = getGeneticCode(geneticCodeId)
  return convertCodingSequenceToPeptides({
    cds,
    sequence,
    codonTable,
    starts,
    translExcept,
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

/**
 * The translation core's own feature panel shows: the contig's or the
 * feature's genetic code, its alternative initiators, and any `transl_except`
 * (RefSeq's selenocysteines), read off the transcript or its CDS as core does.
 */
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
  const { subfeatures, start, end, strand } = feature.toJSON()
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

  const cdsSubfeature = feature
    .get('subfeatures')
    ?.find((f: Feature) => f.get('type')?.toLowerCase() === 'cds')
  const geneticCodeId =
    parseTranslTable(feature.get('transl_table')) ??
    parseTranslTable(cdsSubfeature?.get('transl_table')) ??
    assemblyGeneticCodeId
  const rawTranslExcept =
    feature.get('transl_except') ?? cdsSubfeature?.get('transl_except')

  return calculateProteinSequence({
    cds: strand === -1 ? revlist(cds, seq.length) : cds,
    sequence: strand === -1 ? revcom(seq) : seq,
    geneticCodeId,
    translExcept: rawTranslExcept
      ? relativizeTranslExcept({
          raw: rawTranslExcept,
          featureStart: start,
          featureLength: end - start,
          strand,
        })
      : undefined,
  })
}
