import React, { useState } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import TextField2 from '../../../components/TextField2'
import { DEFAULT_EBI_EMAIL } from '../../../utils/ebiJobDispatcher'

const useStyles = makeStyles()({
  field: {
    minWidth: 300,
  },
  help: {
    marginBottom: 8,
  },
})

export interface BlastSettings {
  ebiEmail: string
}

export default function BlastSettingsDialog({
  handleClose,
  ebiEmail,
}: {
  handleClose: (arg?: BlastSettings) => void
  ebiEmail: string
}) {
  const { classes } = useStyles()
  const [tempEbiEmail, setTempEbiEmail] = useState(ebiEmail)
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
        <Typography variant="subtitle2" className={classes.help}>
          Searches run at EBI, which asks for a contact address on every job so
          they can reach whoever is generating the load. If your site sends real
          volume, use your own.
        </Typography>
        <TextField2
          autoFocus
          margin="dense"
          label="EBI contact email"
          fullWidth
          variant="outlined"
          value={tempEbiEmail}
          className={classes.field}
          onChange={e => {
            setTempEbiEmail(e.target.value)
          }}
        />
        <Button
          variant="contained"
          onClick={() => {
            setTempEbiEmail(DEFAULT_EBI_EMAIL)
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
            handleClose({ ebiEmail: tempEbiEmail })
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
