import React, { useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util'
import SettingsIcon from '@mui/icons-material/Settings'
import { IconButton } from '@mui/material'

import NCBIBlastAutomaticPanel from './NCBIBlastAutomaticPanel'
import NCBIBlastManualPanel from './NCBIBlastManualPanel'
import NCBIBlastMethodSelector from './NCBIBlastMethodSelector'
import NCBISettingsDialog from './NCBISettingsDialog'
import { BASE_BLAST_URL } from './consts'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

export default function NCBIBlastPanel({
  handleClose,
  model,
  feature,
}: {
  handleClose: () => void
  model: AbstractTrackModel
  feature: Feature
}) {
  const [lookupMethod, setLookupMethod] = useState('automatic')
  const [baseUrl, setBaseUrl] = useLocalStorage(
    'msa-blastRootUrl',
    BASE_BLAST_URL,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <IconButton
        style={{ float: 'right' }}
        size="small"
        onClick={() => {
          setSettingsOpen(true)
        }}
      >
        <SettingsIcon />
      </IconButton>

      {lookupMethod === 'automatic' ? (
        <NCBIBlastAutomaticPanel
          model={model}
          feature={feature}
          handleClose={handleClose}
          baseUrl={baseUrl}
        >
          <NCBIBlastMethodSelector
            lookupMethod={lookupMethod}
            setLookupMethod={setLookupMethod}
          />
        </NCBIBlastAutomaticPanel>
      ) : null}
      {lookupMethod === 'manual' ? (
        <NCBIBlastManualPanel
          model={model}
          feature={feature}
          handleClose={handleClose}
          baseUrl={baseUrl}
        >
          <NCBIBlastMethodSelector
            lookupMethod={lookupMethod}
            setLookupMethod={setLookupMethod}
          />
        </NCBIBlastManualPanel>
      ) : null}
      {settingsOpen ? (
        <NCBISettingsDialog
          baseUrl={baseUrl}
          handleClose={arg => {
            if (arg) {
              setBaseUrl(arg)
            }
            setSettingsOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
