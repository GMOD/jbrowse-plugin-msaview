import { useEffect, useMemo, useState } from 'react'

import { featureMatchesId, getId, getSortedTranscriptFeatures } from '../util'
import { useFeatureSequence } from './useFeatureSequence'

import type { Feature } from '@jbrowse/core/util'

function featureInValidIds(feature: Feature, validIds: string[]): boolean {
  return validIds.some(id => featureMatchesId(feature, id))
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
  const selectedTranscript = options.find(val => getId(val) === selectedId)
  const { proteinSequence, error } = useFeatureSequence({
    view,
    feature: selectedTranscript,
  })

  const validSet = useMemo(
    () => (validIds ? new Set(validIds) : undefined),
    [validIds],
  )

  useEffect(() => {
    if (validIds && validIds.length > 0) {
      const currentFeature = options.find(opt => getId(opt) === selectedId)
      if (currentFeature && !featureInValidIds(currentFeature, validIds)) {
        const validOption = options.find(opt =>
          featureInValidIds(opt, validIds),
        )
        if (validOption) {
          setSelectedId(getId(validOption))
        }
      }
    }
  }, [validIds, options, selectedId])

  return {
    options,
    selectedId,
    setSelectedId,
    selectedTranscript,
    proteinSequence,
    error,
    validSet,
  }
}
