import React, { createContext, useContext, useState } from 'react'

import { readLaunchPlacement } from '../../utils/workspaces'

type PlacementState = [boolean, React.Dispatch<React.SetStateAction<boolean>>]

/**
 * Whether the launch opens beside the genome view — one answer for the whole
 * dialog, not one per tab.
 *
 * Every tab the user visits stays mounted, and the checkbox lives in each
 * panel's actions row, so a `useState` there gave each tab its own copy of the
 * answer: ticking the box on one tab and submitting from another wrote the
 * other tab's stale one.
 *
 * Context rather than a prop through all five panels, none of which has any
 * other business with placement.
 */
const LaunchPlacementContext = createContext<PlacementState | undefined>(
  undefined,
)

export function LaunchPlacementProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const state = useState(() => readLaunchPlacement() === 'splitRight')
  return (
    <LaunchPlacementContext.Provider value={state}>
      {children}
    </LaunchPlacementContext.Provider>
  )
}

/** the dialog's answer, or a private one for a panel rendered outside it */
export function useLaunchPlacement(): PlacementState {
  const shared = useContext(LaunchPlacementContext)
  const own = useState(() => readLaunchPlacement() === 'splitRight')
  return shared ?? own
}
