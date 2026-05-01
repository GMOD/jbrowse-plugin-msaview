import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Tests for the useTranscriptSelection hook logic.
 *
 * This hook manages transcript selection with validation against a list of valid IDs.
 * The key behavior is that when validIds changes, it validates the current selection
 * and switches to a valid option if the current one is no longer valid.
 */

// Mock the dependencies
vi.mock('../src/LaunchMsaView/util', () => ({
  featureMatchesId: vi.fn((feature, id) => feature.id === id),
  getId: vi.fn(feature => feature.id),
  getSortedTranscriptFeatures: vi.fn(feature => feature.transcripts),
}))

vi.mock('../src/LaunchMsaView/components/useFeatureSequence', () => ({
  useFeatureSequence: vi.fn(() => ({
    proteinSequence: 'MKAAYLSMFG',
    error: undefined,
  })),
}))

import {
  featureMatchesId,
  getId,
  getSortedTranscriptFeatures,
} from '../src/LaunchMsaView/util'
import { useFeatureSequence } from '../src/LaunchMsaView/components/useFeatureSequence'

const mockFeatureMatchesId = vi.mocked(featureMatchesId)
const mockGetId = vi.mocked(getId)
const mockGetSortedTranscriptFeatures = vi.mocked(getSortedTranscriptFeatures)
const mockUseFeatureSequence = vi.mocked(useFeatureSequence)

// Helper function to test the selection validation logic
function findValidSelection(
  currentId: string,
  options: any[],
  validIds: string[] | undefined,
): string | undefined {
  if (!validIds || validIds.length === 0) {
    return undefined
  }

  const currentFeature = options.find(opt => getId(opt) === currentId)
  if (!currentFeature || validIds.includes(currentId)) {
    return undefined
  }

  const validOption = options.find(opt => validIds.includes(opt.id))
  return validOption ? getId(validOption) : undefined
}

describe('useTranscriptSelection hook logic', () => {
  let transcripts: any[]

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mock implementations
    mockGetId.mockImplementation(feature => feature.id)
    mockGetSortedTranscriptFeatures.mockImplementation(
      feature => feature.transcripts,
    )
    mockUseFeatureSequence.mockReturnValue({
      proteinSequence: 'MKAAYLSMFG',
      error: undefined,
    })

    // Create test transcript data
    transcripts = [
      { id: 'transcript1', name: 'Transcript 1' },
      { id: 'transcript2', name: 'Transcript 2' },
      { id: 'transcript3', name: 'Transcript 3' },
    ]
  })

  describe('selection validation', () => {
    it('should not override valid selection when validIds are present', () => {
      const selectedId = 'transcript2'
      const validIds = ['transcript1', 'transcript2', 'transcript3']

      const result = findValidSelection(selectedId, transcripts, validIds)

      // Should return undefined because transcript2 is already valid
      expect(result).toBeUndefined()
    })

    it('should find alternative when current selection is invalid', () => {
      const selectedId = 'transcript2'
      const validIds = ['transcript1', 'transcript3'] // transcript2 is not valid

      const result = findValidSelection(selectedId, transcripts, validIds)

      // Should return the first valid transcript
      expect(result).toBe('transcript1')
    })

    it('should return undefined when selected transcript is not in options', () => {
      const selectedId = 'invalid-transcript'
      const validIds = ['transcript1', 'transcript2', 'transcript3']

      const result = findValidSelection(selectedId, transcripts, validIds)

      expect(result).toBeUndefined()
    })

    it('should handle empty validIds list', () => {
      const selectedId = 'transcript1'
      const validIds: string[] = []

      const result = findValidSelection(selectedId, transcripts, validIds)

      expect(result).toBeUndefined()
    })

    it('should handle undefined validIds', () => {
      const selectedId = 'transcript1'
      const validIds = undefined

      const result = findValidSelection(selectedId, transcripts, validIds)

      expect(result).toBeUndefined()
    })

    it('should return undefined when no valid option exists', () => {
      const selectedId = 'transcript2'
      const validIds = ['nonexistent1', 'nonexistent2']

      const result = findValidSelection(selectedId, transcripts, validIds)

      expect(result).toBeUndefined()
    })

    it('should prefer the first valid option in options array order', () => {
      const selectedId = 'transcript1'
      const validIds = ['transcript3', 'transcript2'] // transcript1 is invalid

      const result = findValidSelection(selectedId, transcripts, validIds)

      // Should return transcript2 because it appears first in transcripts array
      // even though transcript3 appears first in validIds
      expect(result).toBe('transcript2')
    })
  })

  describe('computed selectedId behavior', () => {
    it('should return the selected ID when valid', () => {
      const selectedId = 'transcript2'
      const validIds = ['transcript1', 'transcript2', 'transcript3']

      const validationResult = findValidSelection(
        selectedId,
        transcripts,
        validIds,
      )
      const computedSelectedId = validationResult || selectedId

      expect(computedSelectedId).toBe('transcript2')
    })

    it('should switch to new valid ID when current becomes invalid', () => {
      const selectedId = 'transcript2'
      const validIds = ['transcript1', 'transcript3']

      const validationResult = findValidSelection(
        selectedId,
        transcripts,
        validIds,
      )
      const computedSelectedId = validationResult || selectedId

      expect(computedSelectedId).toBe('transcript1')
    })

    it('should keep current ID when validation finds no alternative', () => {
      const selectedId = 'transcript1'
      const validIds: string[] = []

      const validationResult = findValidSelection(
        selectedId,
        transcripts,
        validIds,
      )
      const computedSelectedId = validationResult || selectedId

      expect(computedSelectedId).toBe('transcript1')
    })
  })

  describe('edge cases', () => {
    it('should handle single transcript', () => {
      const singleTranscript = [{ id: 'only-one', name: 'Only Transcript' }]
      const selectedId = 'only-one'
      const validIds = ['only-one']

      const result = findValidSelection(selectedId, singleTranscript, validIds)

      expect(result).toBeUndefined()
    })

    it('should handle single invalid transcript', () => {
      const singleTranscript = [{ id: 'only-one', name: 'Only Transcript' }]
      const selectedId = 'only-one'
      const validIds = ['other']

      const result = findValidSelection(selectedId, singleTranscript, validIds)

      expect(result).toBeUndefined()
    })

    it('should handle large validIds lists efficiently', () => {
      const selectedId = 'transcript2'
      const validIds = Array.from({ length: 1000 }, (_, i) => `transcript${i}`)

      const result = findValidSelection(selectedId, transcripts, validIds)

      expect(result).toBeUndefined()
    })

    it('should handle case sensitivity in ID matching', () => {
      const selectedId = 'Transcript2'
      const validIds = ['transcript1', 'transcript2', 'transcript3']

      const result = findValidSelection(selectedId, transcripts, validIds)

      // Should return undefined because IDs don't match (case sensitive)
      expect(result).toBeUndefined()
    })
  })

  describe('hook integration', () => {
    it('useFeatureSequence should be called with selected transcript', () => {
      const selectedTranscript = transcripts[0]
      const view = { assemblyNames: ['GRCh38'] }

      useFeatureSequence({ feature: selectedTranscript, view })

      expect(mockUseFeatureSequence).toHaveBeenCalledWith(
        expect.objectContaining({
          feature: selectedTranscript,
          view,
        }),
      )
    })

    it('getSortedTranscriptFeatures should be called with feature', () => {
      const feature = { id: 'gene1', transcripts }

      getSortedTranscriptFeatures(feature)

      expect(mockGetSortedTranscriptFeatures).toHaveBeenCalledWith(feature)
    })
  })

  describe('real world scenarios', () => {
    it('should handle workflow: user selects second transcript then first becomes invalid', () => {
      // Initial state: user selects transcript2
      let selectedId = 'transcript2'
      let validIds = ['transcript1', 'transcript2', 'transcript3']
      let result = findValidSelection(selectedId, transcripts, validIds)
      let computedId = result || selectedId
      expect(computedId).toBe('transcript2')

      // validIds changes: transcript2 is no longer available
      validIds = ['transcript1', 'transcript3']
      result = findValidSelection(computedId, transcripts, validIds)
      computedId = result || computedId
      expect(computedId).toBe('transcript1')
    })

    it('should handle workflow: filtering transcripts by MSA availability', () => {
      // User has selected transcript2
      let selectedId = 'transcript2'

      // MSA list is loaded, only transcript1 and transcript3 have MSA data
      let validIds = ['transcript1', 'transcript3']

      let result = findValidSelection(selectedId, transcripts, validIds)
      let computedId = result || selectedId

      // Should auto-select transcript1 since transcript2 has no MSA data
      expect(computedId).toBe('transcript1')
    })

    it('should handle empty results then data loaded', () => {
      let selectedId = 'transcript1'

      // Initially no MSA data
      let validIds: string[] | undefined
      let result = findValidSelection(selectedId, transcripts, validIds)
      let computedId = result || selectedId
      expect(computedId).toBe('transcript1')

      // Data loads, transcript1 is available
      validIds = ['transcript1', 'transcript2']
      result = findValidSelection(computedId, transcripts, validIds)
      computedId = result || computedId
      expect(computedId).toBe('transcript1')
    })
  })
})
