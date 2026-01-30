import React, { useState } from 'react'

import { useLocalStorage } from '@jbrowse/core/util'
import SettingsIcon from '@mui/icons-material/Settings'
import { IconButton } from '@mui/material'

import NCBIBlastAutomaticPanel from './NCBIBlastAutomaticPanel'
import NCBIBlastManualPanel from './NCBIBlastManualPanel'
import NCBIBlastMethodSelector from './NCBIBlastMethodSelector'
import NCBIBlastRIDPanel from './NCBIBlastRIDPanel'
import NCBISettingsDialog from './NCBISettingsDialog'
import { BASE_BLAST_URL } from './consts'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const panelMap = {
  automatic: NCBIBlastAutomaticPanel,
  rid: NCBIBlastRIDPanel,
  manual: NCBIBlastManualPanel,
} as const

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

  const Panel = panelMap[lookupMethod as keyof typeof panelMap]

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

      <Panel
        model={model}
        feature={feature}
        handleClose={handleClose}
        baseUrl={baseUrl}
      >
        <NCBIBlastMethodSelector
          lookupMethod={lookupMethod}
          setLookupMethod={setLookupMethod}
        />
      </Panel>

      {settingsOpen ? (
        <NCBISettingsDialog
          baseUrl={baseUrl}
          handleClose={newUrl => {
            if (newUrl) {
              setBaseUrl(newUrl)
            }
            setSettingsOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
