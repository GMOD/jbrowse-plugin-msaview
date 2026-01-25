import React from 'react'

// this is from MUI example
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
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <div>{children}</div>}
    </div>
  )
}
