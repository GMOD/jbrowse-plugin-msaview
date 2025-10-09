import React, { useState } from 'react'

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material'

import { BASE_BLAST_URL } from './consts'

export default function NCBISettingsDialog({
  handleClose,
  baseUrl,
}: {
  handleClose: (arg?: string) => void
  baseUrl: string
}) {
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
        <TextField
          autoFocus
          margin="dense"
          label="BLAST Base URL"
          fullWidth
          variant="outlined"
          value={tempBaseUrl}
          sx={{ minWidth: 300 }}
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
