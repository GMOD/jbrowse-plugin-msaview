// @vitest-environment jsdom
import { SimpleFeature } from '@jbrowse/core/util'
import { renderHook } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { useTranscriptSelection } from './useTranscriptSelection'

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

// the picker sorts by translated length, so the clicked isoform is deliberately
// not the one that would be chosen by default
const gene = new SimpleFeature({
  uniqueId: 'gene1',
  name: 'TP53',
  refName: 'chr1',
  start: 0,
  end: 900,
  type: 'gene',
  subfeatures: [transcript('short', 300), transcript('long', 900)],
})

// `view` is left out so useFeatureSequence has no assembly to fetch against and
// never reaches the session; only the selection is under test here
function selection(preferredTranscriptId?: string) {
  return renderHook(() =>
    useTranscriptSelection({
      feature: gene,
      view: undefined,
      preferredTranscriptId,
    }),
  ).result.current
}

describe('useTranscriptSelection', () => {
  test('opens on the longest transcript with nothing preferred', () => {
    expect(selection().selectedId).toBe('long')
  })

  // climbing to the gene is what puts every isoform in the picker, and it threw
  // away which one the right-click landed on
  test('opens on the isoform the user clicked', () => {
    expect(selection('short').selectedId).toBe('short')
  })

  test('ignores a preferred id this gene does not carry', () => {
    expect(selection('some_other_transcript').selectedId).toBe('long')
  })
})
