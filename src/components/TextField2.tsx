import React from 'react'

import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { TextFieldProps } from '@mui/material'

const TextField2 = observer(function TextField2({
  children,
  ...rest
}: TextFieldProps) {
  return (
    <div>
      <TextField {...rest}>{children}</TextField>
    </div>
  )
})

export default TextField2
