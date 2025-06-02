import { getId } from '../../util'

import type { Feature } from '@jbrowse/core/util'

// Function to find a valid transcript ID that exists in the MSA list
export function findValidTranscriptId({
  transcriptsList,
  validMsaList,
}: {
  transcriptsList: Feature[]
  validMsaList?: string[]
}) {
  if (!validMsaList || validMsaList.length === 0) {
    return null
  }

  // Try to find a transcript ID that exists in the MSA list
  for (const transcript of transcriptsList) {
    const id = getId(transcript)
    if (id && validMsaList.includes(id)) {
      return id
    }
  }
  return null
}
