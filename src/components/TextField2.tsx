import React from 'react'

import { TextField } from '@mui/material'

import type { TextFieldProps } from '@mui/material'

function TextField2({ children, ...rest }: TextFieldProps) {
  return (
    <div>
      <TextField {...rest}>{children}</TextField>
    </div>
  )
}

export default TextField2
