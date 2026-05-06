import React, { useState } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import { BASE_BLAST_URL } from './consts'
import TextField2 from '../../../components/TextField2'

const useStyles = makeStyles()({
  urlField: {
    minWidth: 300,
  },
})

export default function NCBISettingsDialog({
  handleClose,
  baseUrl,
}: {
  handleClose: (arg?: string) => void
  baseUrl: string
}) {
  const { classes } = useStyles()
  const [tempBaseUrl, setTempBaseUrl] = useState(baseUrl)
  return (
    <Dialog
      open
      maxWidth="lg"
      onClose={() => {
        handleClose()
      }}
    >
      <DialogTitle>BLAST Settings</DialogTitle>
      <DialogContent>
        <TextField2
          autoFocus
          margin="dense"
          label="BLAST Base URL"
          fullWidth
          variant="outlined"
          value={tempBaseUrl}
          className={classes.urlField}
          onChange={e => {
            setTempBaseUrl(e.target.value)
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            setTempBaseUrl(BASE_BLAST_URL)
          }}
        >
          Reset
        </Button>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          onClick={() => {
            handleClose(tempBaseUrl)
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
