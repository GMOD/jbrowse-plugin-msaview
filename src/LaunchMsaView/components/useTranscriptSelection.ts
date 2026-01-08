import { useEffect, useMemo, useState } from 'react'

import { getId, getSortedTranscriptFeatures } from '../util'
import { useFeatureSequence } from './useFeatureSequence'

import type { Feature } from '@jbrowse/core/util'

export function useTranscriptSelection({
  feature,
  view,
  validIds,
}: {
  feature: Feature
  view: { assemblyNames?: string[] } | undefined
  validIds?: string[]
}) {
  const options = getSortedTranscriptFeatures(feature)
  const [selectedId, setSelectedId] = useState(getId(options[0]))
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
    if (validIds && validIds.length > 0 && !validIds.includes(selectedId)) {
      const validOption = options.find(opt => validIds.includes(getId(opt)))
      if (validOption) {
        setSelectedId(getId(validOption))
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
