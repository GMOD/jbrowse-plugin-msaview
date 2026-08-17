import { getSession } from '@jbrowse/core/util'

import { getProteinSequenceFromFeature } from './calculateProteinSequence'
import { fetchSeq } from './fetchSeq'
import { useFetch } from '../../utils/useFetch'

import type { Feature } from '@jbrowse/core/util'

interface ViewLike {
  assemblyNames?: string[]
}

export function useFeatureSequence({
  view,
  feature,
}: {
  view: ViewLike | undefined
  feature?: Feature
}) {
  const assemblyName = view?.assemblyNames?.[0]
  const { data: sequence, error } = useFetch(
    feature && assemblyName
      ? [feature.id(), assemblyName, 'feature-sequence']
      : null,
    async () => {
      const { start, end, refName } = feature!.toJSON() as {
        start: number
        end: number
        refName: string
      }
      return {
        seq: await fetchSeq({
          start,
          end,
          refName,
          assemblyName: assemblyName!,
          session: getSession(view),
        }),
      }
    },
  )

  return {
    proteinSequence:
      sequence && feature
        ? getProteinSequenceFromFeature({ seq: sequence.seq, feature })
        : '',
    sequence,
    error,
  }
}
