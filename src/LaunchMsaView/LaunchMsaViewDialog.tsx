import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { Feature, getSession } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'

// locals

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

export default function LaunchProteinViewDialog({
  handleClose,
  feature,
  model,
}: {
  handleClose: () => void
  feature: Feature
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any
}) {
  const { classes } = useStyles()
  const session = getSession(model)

  return (
    <Dialog
      maxWidth="xl"
      title="Launch MSA view"
      onClose={() => handleClose()}
      open
    >
      <DialogContent className={classes.dialogContent}></DialogContent>
      <DialogActions>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            session.addView('MsaView', {
              type: 'MsaView',
            })
            handleClose()
          }}
        >
          Submit
        </Button>
        <Button
          color="secondary"
          variant="contained"
          onClick={() => handleClose()}
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
