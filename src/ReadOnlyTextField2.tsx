import React from 'react'

import { makeStyles } from 'tss-react/mui'

import TextField2 from './TextField2'

const useStyles = makeStyles()({
  textAreaFont: {
    fontFamily: 'Courier New',
  },
})

export default function ReadOnlyTextField2({ value }: { value: string }) {
  const { classes } = useStyles()
  return (
    <TextField2
      variant="outlined"
      multiline
      minRows={5}
      maxRows={10}
      fullWidth
      value={value}
      slotProps={{
        input: {
          readOnly: true,
          classes: {
            input: classes.textAreaFont,
          },
        },
      }}
    />
  )
}
