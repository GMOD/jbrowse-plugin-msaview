import React from 'react'

import { LoadingEllipses } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'

export type SequenceStatus = 'loading' | 'ready' | 'missing' | 'error'

/**
 * Why Submit is grey. The query row is the selected transcript's translation,
 * and fetching and translating it takes a round trip to the sequence adapter,
 * so the button starts disabled on every panel — with nothing to distinguish
 * "wait a moment" from "this gene has no protein and never will".
 *
 * An error says so through the panel's own ErrorMessage, so this stays quiet
 * for that one rather than saying it twice.
 */
export default function SequenceStatusMessage({
  status,
}: {
  status: SequenceStatus
}) {
  return status === 'loading' ? (
    <LoadingEllipses message="Translating transcript" />
  ) : status === 'missing' ? (
    <Typography color="textSecondary" variant="body2">
      no coding sequence to align
    </Typography>
  ) : null
}
