import React from 'react'

import { MenuItem } from '@mui/material'

import TextField2 from '../../../components/TextField2'
import { msaAlgorithmLabels, msaAlgorithms } from './consts'

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
      helperText={
        value === 'browser'
          ? 'no EBI job; rows aligned to the query'
          : undefined
      }
      onChange={event => {
        onChange(event.target.value as MsaAlgorithm)
      }}
    >
      {msaAlgorithms.map(val => (
        <MenuItem value={val} key={val}>
          {msaAlgorithmLabels[val]}
        </MenuItem>
      ))}
    </TextField2>
  )
}
