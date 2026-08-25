import React, { useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Checkbox,
  DialogActions,
  FormControlLabel,
} from '@mui/material'

import {
  readLaunchPlacement,
  sessionSupportsPlacement,
  writeLaunchPlacement,
} from '../../utils/workspaces'

import type { AbstractTrackModel } from '@jbrowse/core/util'

/**
 * Where the launch puts the view, offered wherever a launch is submitted.
 *
 * A checkbox rather than a menu of the three placements: the choice a reader
 * has at this point is "beside the genome view or under it", and `newTab` is a
 * spec's to state, not a thing to pick before you have seen the alignment.
 *
 * Absent entirely on a host that cannot tile — an embedded session, or a
 * release that places views its own way — because the box would do nothing
 * there and every launch would quietly ignore it.
 */
function PlacementToggle({ model }: { model: AbstractTrackModel }) {
  const session = getSession(model)
  const [sideBySide, setSideBySide] = useState(
    () => readLaunchPlacement() === 'splitRight',
  )
  return sessionSupportsPlacement(session) ? (
    <FormControlLabel
      label="Open beside the genome view"
      control={
        <Checkbox
          checked={sideBySide}
          onChange={event => {
            const { checked } = event.target
            setSideBySide(checked)
            writeLaunchPlacement(checked ? 'splitRight' : 'stack')
          }}
        />
      }
    />
  ) : null
}

export default function SubmitCancelActions({
  onSubmit,
  onCancel,
  submitDisabled,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  model,
}: {
  onSubmit: () => void
  onCancel: () => void
  submitDisabled?: boolean
  submitLabel?: string
  cancelLabel?: string
  /** omitted by a panel that submits something other than a view launch */
  model?: AbstractTrackModel
}) {
  return (
    // The buttons are one child rather than two, so a dialog too narrow for
    // the whole row wraps them together underneath the option instead of
    // breaking Cancel away from Submit or shrinking both out of shape.
    <DialogActions sx={{ flexWrap: 'wrap', rowGap: 1 }}>
      {model ? <PlacementToggle model={model} /> : null}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <Button
          sx={{ flexShrink: 0 }}
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
          sx={{ flexShrink: 0 }}
          color="secondary"
          variant="contained"
          onClick={() => {
            onCancel()
          }}
        >
          {cancelLabel}
        </Button>
      </div>
    </DialogActions>
  )
}
