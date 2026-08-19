import { useMemo, useState } from 'react'

import { detectQueryRow, getMsaRowNames } from './detectQueryRow'

/**
 * The MSA row name to launch with, found by sequence rather than typed.
 *
 * Only the user's override is state. The detected name is derived from the
 * pasted text during render, so pasting a new alignment re-detects without an
 * effect writing back into state, and an override survives later edits to the
 * alignment because it is the one thing actually stored.
 */
export function useQueryRowName(msaText: string, proteinSequence: string) {
  const [override, setOverride] = useState<string>()

  // parsing runs on every keystroke in the paste box otherwise, and an
  // alignment of a few hundred rows is not free
  const { detected, names } = useMemo(
    () => ({
      detected: detectQueryRow(msaText, proteinSequence),
      names: getMsaRowNames(msaText),
    }),
    [msaText, proteinSequence],
  )

  return {
    detected,
    names,
    querySeqName: override ?? detected?.name ?? '',
    setQuerySeqName: setOverride,
    isAutoDetected: override === undefined && !!detected,
  }
}
