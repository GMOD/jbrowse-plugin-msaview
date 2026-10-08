import { useMemo } from 'react'

import { getSession } from '@jbrowse/core/util'
import { translateTranscript } from '@jbrowse/core/util/translateTranscript'

import { useFetch } from '../../utils/useFetch'
import { fetchSeq } from './fetchSeq'

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
  const {
    data: sequence,
    error,
    isLoading,
  } = useFetch(
    feature && assemblyName
      ? [feature.id(), assemblyName, 'feature-sequence']
      : null,
    async () => {
      const { start, end, refName } = feature!.toJSON() as {
        start: number
        end: number
        refName: string
      }
      return fetchSeq({
        start,
        end,
        refName,
        assemblyName: assemblyName!,
        session: getSession(view),
      })
    },
  )

  const proteinSequence = useMemo(
    () =>
      sequence && feature
        ? (translateTranscript({ transcript: feature, ...sequence })?.protein ??
          '')
        : '',
    [sequence, feature],
  )
  return {
    proteinSequence,
    sequence,
    error,
    isLoading,
  }
}
