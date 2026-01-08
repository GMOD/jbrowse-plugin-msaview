import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
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

import type { JBrowsePluginMsaViewModel } from '../model'

const ConnectStructureDialog = observer(function ConnectStructureDialog({
  model,
  handleClose,
}: {
  model: JBrowsePluginMsaViewModel
  handleClose: () => void
}) {
  const session = getSession(model)
  const [selectedViewId, setSelectedViewId] = useState('')
  const [selectedStructureIdx, setSelectedStructureIdx] = useState(0)
  const [selectedMsaRow, setSelectedMsaRow] = useState(model.querySeqName)
  const [error, setError] = useState<string>()

  // Find all ProteinViews in the session

  const proteinViews = session.views.filter(
    (v: any) => v.type === 'ProteinView',
  ) as any[]

  // Get structures for the selected view
  const selectedView = proteinViews.find(v => v.id === selectedViewId)
  const structures = selectedView?.structures ?? []

  // Get MSA row names
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
            <FormControl fullWidth sx={{ mb: 2 }}>
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
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Structure</InputLabel>
                <Select
                  value={selectedStructureIdx}
                  label="Structure"
                  onChange={e => {
                    setSelectedStructureIdx(e.target.value)
                  }}
                >
                  {structures.map(
                    (structure: { url?: string }, idx: number) => (
                      <MenuItem key={idx} value={idx}>
                        {structure.url ?? `Structure ${idx + 1}`}
                      </MenuItem>
                    ),
                  )}
                </Select>
              </FormControl>
            )}

            <FormControl fullWidth sx={{ mb: 2 }}>
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

            {error && (
              <Typography color="error" sx={{ mt: 1 }}>
                {error}
              </Typography>
            )}
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
