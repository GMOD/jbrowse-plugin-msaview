import React from 'react'
import { TextField, TextFieldProps } from '@mui/material'

function TextField2({ children, ...rest }: TextFieldProps) {
  return (
    <div>
      <TextField {...rest}>{children}</TextField>
    </div>
  )
}

export default TextField2
