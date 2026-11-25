import React, { createContext, useMemo, useState } from 'react'

import { observer } from 'mobx-react'

import { featureMatchesId, getId, getSortedTranscriptFeatures } from '../util'
import { useFeatureSequence } from './useFeatureSequence'

import type { Feature } from '@jbrowse/core/util'

type PickState = [
  string | undefined,
  React.Dispatch<React.SetStateAction<string | undefined>>,
]

interface TranscriptChoice {
  pick: PickState
  sequenceFor: string
  sequence: ReturnType<typeof useFeatureSequence>
}

export const TranscriptChoiceContext = createContext<
  TranscriptChoice | undefined
>(undefined)

export function defaultTranscriptId(
  options: Feature[],
  preferredTranscriptId: string | undefined,
) {
  return getId(
    options.find(opt => featureMatchesId(opt, preferredTranscriptId ?? '')) ??
      options[0],
  )
}

export const TranscriptChoiceProvider = observer(
  function TranscriptChoiceProvider({
    feature,
    view,
    preferredTranscriptId,
    children,
  }: {
    feature: Feature
    view: { assemblyNames?: string[] } | undefined
    preferredTranscriptId?: string
    children: React.ReactNode
  }) {
    const options = useMemo(
      () => getSortedTranscriptFeatures(feature),
      [feature],
    )
    const pick = useState<string>()
    const sequenceFor =
      pick[0] ?? defaultTranscriptId(options, preferredTranscriptId)
    const sequence = useFeatureSequence({
      view,
      feature: options.find(opt => getId(opt) === sequenceFor),
    })
    return (
      <TranscriptChoiceContext.Provider value={{ pick, sequenceFor, sequence }}>
        {children}
      </TranscriptChoiceContext.Provider>
    )
  },
)
