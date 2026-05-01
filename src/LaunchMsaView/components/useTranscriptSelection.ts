import { useMemo, useState } from 'react'

import { featureMatchesId, getId, getSortedTranscriptFeatures } from '../util'
import { useFeatureSequence } from './useFeatureSequence'

import type { Feature } from '@jbrowse/core/util'

function featureInValidIds(feature: Feature, validIds: string[]): boolean {
  return validIds.some(id => featureMatchesId(feature, id))
}

function findValidSelection(
  currentId: string,
  options: Feature[],
  validIds: string[] | undefined,
): string | undefined {
  if (!validIds || validIds.length === 0) {
    return undefined
  }

  const currentFeature = options.find(opt => getId(opt) === currentId)
  if (!currentFeature || featureInValidIds(currentFeature, validIds)) {
    return undefined
  }

  const validOption = options.find(opt => featureInValidIds(opt, validIds))
  return validOption ? getId(validOption) : undefined
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
  const validatedSelectedId =
    findValidSelection(selectedId, options, validIds) || selectedId
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
