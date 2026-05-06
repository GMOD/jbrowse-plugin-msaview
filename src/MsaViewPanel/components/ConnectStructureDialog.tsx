import React, { useState } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import { isProteinView } from '../structureConnection'

import type { JBrowsePluginMsaViewModel } from '../model'

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(2),
  },
}))

const ConnectStructureDialog = observer(function ConnectStructureDialog({
  model,
  handleClose,
}: {
  model: JBrowsePluginMsaViewModel
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const [selectedViewId, setSelectedViewId] = useState('')
  const [selectedStructureIdx, setSelectedStructureIdx] = useState(0)
  const [selectedMsaRow, setSelectedMsaRow] = useState(model.querySeqName)
  const [error, setError] = useState<string>()

  const proteinViews = (session.views as unknown[]).filter(isProteinView)

  const selectedView = proteinViews.find(v => v.id === selectedViewId)
  const structures = selectedView?.structures ?? []

  const msaRowNames = model.rows.map(r => r[0])

  const handleConnect = () => {
    if (!selectedViewId) {
      setError('Please select a protein view')
      return
    }

    try {
      model.connectToStructure(
        selectedViewId,
        selectedStructureIdx,
        selectedMsaRow,
      )
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <Dialog
      maxWidth="sm"
      title="Connect to Protein Structure"
      open
      onClose={handleClose}
    >
      <DialogContent>
        {proteinViews.length === 0 ? (
          <Typography color="textSecondary">
            No protein views are currently open. Please open a protein structure
            view first.
          </Typography>
        ) : (
          <>
            <FormControl fullWidth className={classes.formControl}>
              <InputLabel>Protein View</InputLabel>
              <Select
                value={selectedViewId}
                label="Protein View"
                onChange={e => {
                  setSelectedViewId(e.target.value)
                  setSelectedStructureIdx(0)
                }}
              >
                {proteinViews.map(view => (
                  <MenuItem key={view.id} value={view.id}>
                    {view.displayName ?? `ProteinView ${view.id}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {structures.length > 1 && (
              <FormControl fullWidth className={classes.formControl}>
                <InputLabel>Structure</InputLabel>
                <Select
                  value={selectedStructureIdx}
                  label="Structure"
                  onChange={e => {
                    setSelectedStructureIdx(e.target.value)
                  }}
                >
                  {structures.map((structure, idx) => (
                    <MenuItem key={idx} value={idx}>
                      {structure.url ?? `Structure ${idx + 1}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth className={classes.formControl}>
              <InputLabel>MSA Row</InputLabel>
              <Select
                value={selectedMsaRow}
                label="MSA Row"
                onChange={e => {
                  setSelectedMsaRow(e.target.value)
                }}
              >
                {msaRowNames.map(name => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {error && <ErrorMessage error={error} />}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleConnect}
          variant="contained"
          disabled={proteinViews.length === 0 || !selectedViewId}
        >
          Connect
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default ConnectStructureDialog
