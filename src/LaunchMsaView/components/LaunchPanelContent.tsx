import React from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { DialogContent } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

const LaunchPanelContent = observer(function LaunchPanelContent({
  error,
  children,
}: {
  error?: unknown
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  return (
    <DialogContent className={classes.dialogContent}>
      {error ? <ErrorMessage error={error} /> : null}
      {children}
    </DialogContent>
  )
})

export default LaunchPanelContent
