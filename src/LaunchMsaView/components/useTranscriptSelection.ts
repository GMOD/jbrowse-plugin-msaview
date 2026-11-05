import { useMemo, useState } from 'react'

import { featureMatchesId, getId, getSortedTranscriptFeatures } from '../util'
import { useFeatureSequence } from './useFeatureSequence'

import type { SequenceStatus } from './SequenceStatus'
import type { Feature } from '@jbrowse/core/util'

// Keep the current selection if it has data, otherwise fall back to the first
// option that does (or the current id if none do). With no hasData constraint
// the current selection always stands.
export function pickSelectedId(
  currentId: string,
  options: Feature[],
  hasData: ((transcript: Feature) => boolean) | undefined,
): string {
  if (!hasData) {
    return currentId
  }
  const current = options.find(opt => getId(opt) === currentId)
  if (current && hasData(current)) {
    return currentId
  }
  const firstValid = options.find(hasData)
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
  hasData,
  preferredTranscriptId,
}: {
  feature: Feature
  view: { assemblyNames?: string[] } | undefined
  /** which transcripts the panel can offer, when it can only offer some */
  hasData?: (transcript: Feature) => boolean
  /**
   * the isoform the user right-clicked, when the dialog opened on its gene.
   * Ignored when this gene does not carry it, so a stale id falls back to the
   * longest transcript rather than selecting nothing.
   */
  preferredTranscriptId?: string
}) {
  const options = useMemo(() => getSortedTranscriptFeatures(feature), [feature])
  const [selectedId, setSelectedId] = useState(() =>
    getId(
      options.find(opt => featureMatchesId(opt, preferredTranscriptId ?? '')) ??
        options[0],
    ),
  )
  const validatedSelectedId = pickSelectedId(selectedId, options, hasData)
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
    hasData,
  }
}
