import React, { useRef } from 'react'

// Once visited, a panel stays mounted and is hidden with the `hidden` attribute.
// Unmounting it discarded whatever the user had typed and re-ran every fetch the
// panel makes on the way back, so switching tabs to compare two of them cost an
// EBI round trip and the pasted alignment.
//
// Lazy on first visit rather than mounted up front, because a panel mounts
// fetches of its own: rendering all four on open would query the MSA dataset
// adapter and the BLAST cache for tabs nobody looked at.
export default function TabPanel({
  children,
  value,
  index,
  ...other
}: {
  children?: React.ReactNode
  index: number | string
  value: number | string
}) {
  const active = value === index
  const visited = useRef(active)
  visited.current ||= active
  return (
    <div role="tabpanel" hidden={!active} {...other}>
      {visited.current ? children : null}
    </div>
  )
}
