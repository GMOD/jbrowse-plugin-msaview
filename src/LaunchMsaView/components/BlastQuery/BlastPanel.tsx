import React, { useState } from 'react'

import SettingsIcon from '@mui/icons-material/Settings'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import {
  DEFAULT_EBI_EMAIL,
  EBI_EMAIL_STORAGE_KEY,
} from '../../../utils/ebiJobDispatcher'
import { useLocalStorage } from '../../../utils/useLocalStorage'
import TabPanel from '../TabPanel'
import BlastAutomaticPanel from './BlastAutomaticPanel'
import BlastManualPanel from './BlastManualPanel'
import BlastMethodSelector from './BlastMethodSelector'
import BlastSettingsDialog from './BlastSettingsDialog'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  settingsButton: {
    float: 'right',
  },
})

export type BlastLookupMethod = 'automatic' | 'manual'

const BlastPanel = observer(function BlastPanel({
  handleClose,
  model,
  feature,
  preferredTranscriptId,
}: {
  handleClose: () => void
  model: AbstractTrackModel
  feature: Feature
  /** the isoform the user right-clicked, preselected in the picker */
  preferredTranscriptId?: string
}) {
  const [lookupMethod, setLookupMethod] =
    useState<BlastLookupMethod>('automatic')
  const [ebiEmail, setEbiEmail] = useLocalStorage(
    EBI_EMAIL_STORAGE_KEY,
    DEFAULT_EBI_EMAIL,
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { classes } = useStyles()
  const methodSelector = (
    <BlastMethodSelector
      lookupMethod={lookupMethod}
      setLookupMethod={setLookupMethod}
    />
  )

  return (
    <>
      {/* a bare gear said nothing about what it opened, and the address the
          job carries was invisible until you opened it */}
      {lookupMethod === 'automatic' ? (
        <Tooltip
          title={`EBI settings — jobs are submitted with ${ebiEmail.trim() || DEFAULT_EBI_EMAIL}`}
        >
          <IconButton
            className={classes.settingsButton}
            aria-label="EBI settings"
            size="small"
            onClick={() => {
              setSettingsOpen(true)
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      ) : null}

      <TabPanel value={lookupMethod} index="automatic">
        <BlastAutomaticPanel
          model={model}
          feature={feature}
          handleClose={handleClose}
          preferredTranscriptId={preferredTranscriptId}
        >
          {methodSelector}
        </BlastAutomaticPanel>
      </TabPanel>
      <TabPanel value={lookupMethod} index="manual">
        <BlastManualPanel
          model={model}
          feature={feature}
          handleClose={handleClose}
          preferredTranscriptId={preferredTranscriptId}
        >
          {methodSelector}
        </BlastManualPanel>
      </TabPanel>

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
})

export default BlastPanel
