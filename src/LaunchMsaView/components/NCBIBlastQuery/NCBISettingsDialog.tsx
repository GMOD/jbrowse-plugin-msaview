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

import { BASE_BLAST_URL } from './consts'
import TextField2 from '../../../components/TextField2'
import { DEFAULT_EBI_EMAIL } from '../../../utils/ebiJobDispatcher'

const useStyles = makeStyles()({
  urlField: {
    minWidth: 300,
  },
  section: {
    marginTop: 20,
  },
  help: {
    marginBottom: 8,
  },
})

export interface BlastSettings {
  baseUrl: string
  ebiEmail: string
}

export default function NCBISettingsDialog({
  handleClose,
  baseUrl,
  ebiEmail,
}: {
  handleClose: (arg?: BlastSettings) => void
  baseUrl: string
  ebiEmail: string
}) {
  const { classes } = useStyles()
  const [tempBaseUrl, setTempBaseUrl] = useState(baseUrl)
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
          NCBI no longer lets browsers read responses from Blast.cgi. Point this
          at a proxy you host to use the NCBI service; the EBI service needs no
          proxy.
        </Typography>
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

        <div className={classes.section}>
          <Typography variant="subtitle2" className={classes.help}>
            EBI asks for a contact address on every job so they can reach
            whoever is generating the load. If your site sends real volume, use
            your own.
          </Typography>
          <TextField2
            margin="dense"
            label="EBI contact email"
            fullWidth
            variant="outlined"
            value={tempEbiEmail}
            className={classes.urlField}
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
        </div>
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
            handleClose({ baseUrl: tempBaseUrl, ebiEmail: tempEbiEmail })
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}
