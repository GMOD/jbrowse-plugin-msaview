import { getProteinSequenceFromFeature } from './calculateProteinSequence'
import { useSWRFeatureSequence } from './useSWRFeatureSequence'

import type { Feature } from '@jbrowse/core/util'

export function useFeatureSequence({
  view,
  feature,
}: {
  view: { assemblyNames?: string[] } | undefined
  feature?: Feature
}) {
  const { sequence, error } = useSWRFeatureSequence({
    view,
    feature,
  })

  const proteinSequence =
    sequence && feature
      ? getProteinSequenceFromFeature({
          seq: sequence.seq,
          feature,
        })
      : ''

  return {
    proteinSequence,
    sequence,
    error,
  }
}
