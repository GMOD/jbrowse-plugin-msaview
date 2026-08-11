import React, { useState } from 'react'

import SettingsIcon from '@mui/icons-material/Settings'
import { IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

import BlastAutomaticPanel from './BlastAutomaticPanel'
import BlastManualPanel from './BlastManualPanel'
import BlastMethodSelector from './BlastMethodSelector'
import BlastSettingsDialog from './BlastSettingsDialog'
import {
  DEFAULT_EBI_EMAIL,
  EBI_EMAIL_STORAGE_KEY,
} from '../../../utils/ebiJobDispatcher'
import { useLocalStorage } from '../../../utils/useLocalStorage'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  settingsButton: {
    float: 'right',
  },
})

const panelMap = {
  automatic: BlastAutomaticPanel,
  manual: BlastManualPanel,
} as const

export type BlastLookupMethod = keyof typeof panelMap

export default function BlastPanel({
  handleClose,
  model,
  feature,
}: {
  handleClose: () => void
  model: AbstractTrackModel
  feature: Feature
}) {
  const [lookupMethod, setLookupMethod] =
    useState<BlastLookupMethod>('automatic')
  const [ebiEmail, setEbiEmail] = useLocalStorage(
    EBI_EMAIL_STORAGE_KEY,
    DEFAULT_EBI_EMAIL,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { classes } = useStyles()

  const Panel = panelMap[lookupMethod]

  return (
    <>
      <IconButton
        className={classes.settingsButton}
        size="small"
        onClick={() => {
          setSettingsOpen(true)
        }}
      >
        <SettingsIcon />
      </IconButton>

      <Panel model={model} feature={feature} handleClose={handleClose}>
        <BlastMethodSelector
          lookupMethod={lookupMethod}
          setLookupMethod={setLookupMethod}
        />
      </Panel>

      {settingsOpen ? (
        <BlastSettingsDialog
          ebiEmail={ebiEmail}
          handleClose={settings => {
            if (settings) {
              setEbiEmail(settings.ebiEmail)
            }
            setSettingsOpen(false)
          }}
        />
      ) : null}
    </>
  )
}
