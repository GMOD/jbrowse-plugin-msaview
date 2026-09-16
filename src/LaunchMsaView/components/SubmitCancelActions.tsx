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
function PlacementToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <FormControlLabel
      label="Open beside the genome view"
      control={
        <Checkbox
          checked={checked}
          onChange={event => {
            onChange(event.target.checked)
          }}
        />
      }
    />
  )
}

export default function SubmitCancelActions({
  onSubmit,
  onCancel,
  submitDisabled,
  hint,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  model,
}: {
  onSubmit: () => void
  onCancel: () => void
  submitDisabled?: boolean
  /** why Submit is grey, shown beside it */
  hint?: React.ReactNode
  submitLabel?: string
  cancelLabel?: string
  /** omitted by a panel that submits something other than a view launch */
  model?: AbstractTrackModel
}) {
  const [sideBySide, setSideBySide] = useState(
    () => readLaunchPlacement() === 'splitRight',
  )
  // The stored value is what the next launch reads, so it is written on submit
  // rather than on the click: ticking the box and then pressing Cancel used to
  // change where every future launch landed, from a dialog the user backed out
  // of.
  const offerPlacement = !!model && sessionSupportsPlacement(getSession(model))
  return (
    // The buttons are one child rather than two, so a dialog too narrow for
    // the whole row wraps them together underneath the option instead of
    // breaking Cancel away from Submit or shrinking both out of shape.
    <DialogActions sx={{ flexWrap: 'wrap', rowGap: 1 }}>
      {offerPlacement ? (
        <PlacementToggle checked={sideBySide} onChange={setSideBySide} />
      ) : null}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginLeft: 'auto',
        }}
      >
        {hint}
        <Button
          sx={{ flexShrink: 0 }}
          color="primary"
          variant="contained"
          disabled={submitDisabled}
          onClick={() => {
            if (offerPlacement) {
              writeLaunchPlacement(sideBySide ? 'splitRight' : 'stack')
            }
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
