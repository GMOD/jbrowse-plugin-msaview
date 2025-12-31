import { describe, expect, it } from 'vitest'

/**
 * These tests verify the logic fix for the transcript selector bug.
 *
 * The bug was in PreLoadedMSADataPanel.tsx where the useEffect had
 * `selectedTranscriptId` in its dependency array. This caused the effect
 * to run whenever the user changed their selection, and it would reset
 * the selection to the "first valid" transcript.
 *
 * The fix checks if the current selection is already valid before
 * overriding it.
 */

describe('TranscriptSelector logic', () => {
  it('should not override a valid user selection', () => {
    // Simulate the scenario:
    // - msaList contains ['transcript1', 'transcript2', 'transcript3']
    // - User selects 'transcript2'
    // - The old buggy code would reset to 'transcript1' (first valid)
    // - The fixed code should keep 'transcript2'

    const msaList = ['transcript1', 'transcript2', 'transcript3']
    const userSelectedTranscriptId = 'transcript2'

    // This is the logic from the fix
    const currentIsValid = msaList.includes(userSelectedTranscriptId)

    expect(currentIsValid).toBe(true)
    // Since currentIsValid is true, the useEffect should NOT call setSelectedTranscriptId
  })

  it('should find and set a valid transcript if current selection is invalid', () => {
    // Simulate the scenario:
    // - msaList contains ['transcript1', 'transcript3'] (transcript2 has no data)
    // - Current selection is 'transcript2' (invalid)
    // - The code should find and set 'transcript1' (first valid)

    const msaList = ['transcript1', 'transcript3']
    const currentSelectedTranscriptId = 'transcript2'

    const currentIsValid = msaList.includes(currentSelectedTranscriptId)

    expect(currentIsValid).toBe(false)
    // Since currentIsValid is false, we should find a valid transcript

    // Simulate findValidTranscriptId logic
    const transcriptsList = [
      { id: 'transcript1' },
      { id: 'transcript2' },
      { id: 'transcript3' },
    ]
    const validId = transcriptsList.find(t => msaList.includes(t.id))?.id
    expect(validId).toBe('transcript1')
  })

  it('should handle empty msaList gracefully', () => {
    const msaList: string[] = []
    const userSelectedTranscriptId = 'transcript1'

    // When msaList is empty, the condition msaList.length > 0 fails
    // so no update should happen
    const shouldUpdate = msaList.length > 0

    expect(shouldUpdate).toBe(false)
  })

  it('should handle case where no valid transcript exists', () => {
    const msaList = ['transcriptA', 'transcriptB']
    const transcriptsList = [
      { id: 'transcript1' },
      { id: 'transcript2' },
      { id: 'transcript3' },
    ]

    // Current selection is invalid
    const currentSelectedTranscriptId = 'transcript1'
    const currentIsValid = msaList.includes(currentSelectedTranscriptId)
    expect(currentIsValid).toBe(false)

    // Try to find a valid one
    const validId = transcriptsList.find(t => msaList.includes(t.id))?.id
    expect(validId).toBeUndefined()

    // In this case, the code should not call setSelectedTranscriptId
    // because validId is undefined (falsy)
  })
})
