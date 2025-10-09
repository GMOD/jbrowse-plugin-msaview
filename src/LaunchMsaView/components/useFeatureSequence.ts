import { getProteinSequenceFromFeature } from './calculateProteinSequence'
import { useSWRFeatureSequence } from './useSWRFeatureSequence'

import type { Feature } from '@jbrowse/core/util'

export function useFeatureSequence({
  view,
  feature,
  upDownBp = 0,
  forceLoad = true,
}: {
  view: { assemblyNames?: string[] } | undefined
  feature?: Feature
  upDownBp?: number
  forceLoad?: boolean
}) {
  const { sequence, error } = useSWRFeatureSequence({
    view,
    feature,
    upDownBp,
    forceLoad,
  })

  const proteinSequence =
    sequence && !('error' in sequence) && sequence.seq && feature
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
