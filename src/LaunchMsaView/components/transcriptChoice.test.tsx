// @vitest-environment jsdom
import React from 'react'

import { SimpleFeature } from '@jbrowse/core/util'
import { act, renderHook } from '@testing-library/react'
import { observer } from 'mobx-react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { TranscriptChoiceProvider } from './transcriptChoice'
import { useFeatureSequence } from './useFeatureSequence'
import { useTranscriptSelection } from './useTranscriptSelection'

import type { Feature } from '@jbrowse/core/util'

vi.mock('./useFeatureSequence', () => ({
  useFeatureSequence: vi.fn(),
}))

function transcript(id: string, cdsLength: number) {
  return {
    uniqueId: id,
    name: id,
    refName: 'chr1',
    start: 0,
    end: cdsLength,
    type: 'mRNA',
    subfeatures: [
      {
        uniqueId: `${id}-cds`,
        refName: 'chr1',
        start: 0,
        end: cdsLength,
        type: 'CDS',
      },
    ],
  }
}

const gene = new SimpleFeature({
  uniqueId: 'gene1',
  name: 'TP53',
  refName: 'chr1',
  start: 0,
  end: 900,
  type: 'gene',
  subfeatures: [
    transcript('short', 300),
    transcript('mid', 600),
    transcript('long', 900),
  ],
})

const view = { assemblyNames: ['hg38'] }
const datasetHasData = (t: Feature) => t.id() !== 'long'

const Dialog = observer(function Dialog({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TranscriptChoiceProvider feature={gene} view={view}>
      {children}
    </TranscriptChoiceProvider>
  )
})

function twoPanels(wrapper?: typeof Dialog) {
  return renderHook(
    () => ({
      orthologs: useTranscriptSelection({ feature: gene, view }),
      preloaded: useTranscriptSelection({
        feature: gene,
        view,
        hasData: datasetHasData,
      }),
    }),
    { wrapper },
  ).result
}

function fetchedIds() {
  return vi
    .mocked(useFeatureSequence)
    .mock.calls.flatMap(([{ feature }]) => (feature ? [feature.id()] : []))
}

beforeEach(() => {
  vi.mocked(useFeatureSequence).mockReset()
  vi.mocked(useFeatureSequence).mockImplementation(({ feature }) => ({
    proteinSequence: feature ? `protein of ${feature.id()}` : '',
    error: undefined,
    isLoading: false,
  }))
})

describe('one isoform choice for the whole dialog', () => {
  test('a pick in one panel shows in another', () => {
    const result = twoPanels(Dialog)
    act(() => {
      result.current.preloaded.setSelectedId('short')
    })
    expect(result.current.orthologs.selectedId).toBe('short')
    expect(result.current.orthologs.proteinSequence).toBe('protein of short')
  })

  test('until a pick, each panel shows its own default', () => {
    const result = twoPanels(Dialog)
    expect(result.current.orthologs.selectedId).toBe('long')
    expect(result.current.preloaded.selectedId).toBe('mid')
  })

  test('a pick the dataset has no data for stands elsewhere and is kept', () => {
    const result = twoPanels(Dialog)
    act(() => {
      result.current.orthologs.setSelectedId('short')
    })
    expect(result.current.preloaded.selectedId).toBe('short')
    act(() => {
      result.current.orthologs.setSelectedId('long')
    })
    expect(result.current.preloaded.selectedId).toBe('mid')
    expect(result.current.orthologs.selectedId).toBe('long')
  })

  test('the transcript is fetched once for the panels that agree on it', () => {
    twoPanels(Dialog)
    expect(fetchedIds()).toEqual(['long', 'mid'])
  })

  test('outside the dialog each panel keeps its own pick', () => {
    const result = twoPanels()
    act(() => {
      result.current.preloaded.setSelectedId('short')
    })
    expect(result.current.preloaded.selectedId).toBe('short')
    expect(result.current.orthologs.selectedId).toBe('long')
    expect(result.current.orthologs.proteinSequence).toBe('protein of long')
  })
})
