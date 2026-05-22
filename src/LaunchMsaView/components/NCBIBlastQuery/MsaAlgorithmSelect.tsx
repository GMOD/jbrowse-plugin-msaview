import React from 'react'

import { MenuItem } from '@mui/material'

import { msaAlgorithms } from './consts'
import TextField2 from '../../../components/TextField2'

import type { MsaAlgorithm } from './consts'

export default function MsaAlgorithmSelect({
  value,
  onChange,
  className,
}: {
  value: MsaAlgorithm
  onChange: (val: MsaAlgorithm) => void
  className?: string
}) {
  return (
    <TextField2
      variant="outlined"
      label="MSA Algorithm"
      className={className}
      select
      value={value}
      onChange={event => {
        onChange(event.target.value as MsaAlgorithm)
      }}
    >
      {msaAlgorithms.map(val => (
        <MenuItem value={val} key={val}>
          {val}
        </MenuItem>
      ))}
    </TextField2>
  )
}
