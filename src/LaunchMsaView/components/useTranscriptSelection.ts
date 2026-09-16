import { useMemo, useState } from 'react'

import { featureMatchesId, getId, getSortedTranscriptFeatures } from '../util'
import { useFeatureSequence } from './useFeatureSequence'

import type { SequenceStatus } from './SequenceStatus'
import type { Feature } from '@jbrowse/core/util'

// Keep the current selection if it's valid for the given validIds, otherwise
// fall back to the first valid option (or the current id if none qualify). With
// no validIds constraint the current selection always stands.
function pickSelectedId(
  currentId: string,
  options: Feature[],
  validIds: string[] | undefined,
): string {
  if (!validIds?.length) {
    return currentId
  }
  const isValid = (opt: Feature) =>
    validIds.some(id => featureMatchesId(opt, id))
  const current = options.find(opt => getId(opt) === currentId)
  if (current && isValid(current)) {
    return currentId
  }
  const firstValid = options.find(isValid)
  return firstValid ? getId(firstValid) : currentId
}

/**
 * Submit is disabled until the query sequence is in hand, and a grey button
 * reads the same whether the translation is on its way or was never going to
 * arrive. `missing` is the second case: the feature has no CDS to translate,
 * which the dialog never said.
 */
function sequenceStatus({
  error,
  isLoading,
  proteinSequence,
}: {
  error: unknown
  isLoading: boolean
  proteinSequence: string
}): SequenceStatus {
  if (error) {
    return 'error'
  }
  if (isLoading) {
    return 'loading'
  }
  return proteinSequence ? 'ready' : 'missing'
}

export function useTranscriptSelection({
  feature,
  view,
  validIds,
}: {
  feature: Feature
  view: { assemblyNames?: string[] } | undefined
  validIds?: string[]
}) {
  const options = useMemo(() => getSortedTranscriptFeatures(feature), [feature])
  const [selectedId, setSelectedId] = useState(() => getId(options[0]))
  const validatedSelectedId = pickSelectedId(selectedId, options, validIds)
  const selectedTranscript = options.find(
    val => getId(val) === validatedSelectedId,
  )
  const { proteinSequence, error, isLoading } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  return {
    options,
    selectedId: validatedSelectedId,
    setSelectedId,
    selectedTranscript,
    proteinSequence,
    error,
    isLoading,
    sequenceStatus: sequenceStatus({ error, isLoading, proteinSequence }),
    validIds,
  }
}
