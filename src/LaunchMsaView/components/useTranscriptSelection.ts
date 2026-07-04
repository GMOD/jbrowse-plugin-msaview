import { useMemo, useState } from 'react'

import { featureMatchesId, getId, getSortedTranscriptFeatures } from '../util'
import { useFeatureSequence } from './useFeatureSequence'

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
  const { proteinSequence, error } = useFeatureSequence({
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
    validIds,
  }
}
