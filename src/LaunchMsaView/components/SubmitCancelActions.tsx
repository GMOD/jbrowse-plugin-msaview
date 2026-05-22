import React from 'react'

import { Button, DialogActions } from '@mui/material'

export default function SubmitCancelActions({
  onSubmit,
  onCancel,
  submitDisabled,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
}: {
  onSubmit: () => void
  onCancel: () => void
  submitDisabled?: boolean
  submitLabel?: string
  cancelLabel?: string
}) {
  return (
    <DialogActions>
      <Button
        color="primary"
        variant="contained"
        disabled={submitDisabled}
        onClick={() => {
          onSubmit()
        }}
      >
        {submitLabel}
      </Button>
      <Button
        color="secondary"
        variant="contained"
        onClick={() => {
          onCancel()
        }}
      >
        {cancelLabel}
      </Button>
    </DialogActions>
  )
}
