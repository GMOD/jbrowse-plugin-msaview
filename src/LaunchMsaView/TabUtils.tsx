import React from 'react'
import { Box } from '@mui/material'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

export function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`gtabpanel-${index}`}
      aria-labelledby={`gtab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}
export function a11yProps(index: number) {
  return {
    id: `gtab-${index}`,
    'aria-controls': `gtabpanel-${index}`,
  }
}
