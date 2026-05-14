import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Tab, Tabs } from '@mui/material'

import ManualMSALoader from './ManualMSALoader/ManualMSALoader'
import NCBIBlastPanel from './NCBIBlastQuery/NCBIBlastPanel'
import PreLoadedMSA from './PreLoadedMSA/PreLoadedMSADataPanel'
import { readMsaDatasets } from './PreLoadedMSA/types'
import TabPanel from './TabPanel'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

export default function LaunchMsaViewDialog({
  handleClose,
  feature,
  model,
}: {
  handleClose: () => void
  feature: Feature
  model: AbstractTrackModel
}) {
  const session = getSession(model)
  const datasets = readMsaDatasets(session.jbrowse)
  const hasPreloadedDatasets = !!datasets?.length

  const [value, setValue] = useState('ncbi_blast')

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    setValue(newValue)
  }

  return (
    <Dialog maxWidth="xl" title="Launch MSA view" open onClose={handleClose}>
      <Tabs value={value} onChange={handleChange}>
        <Tab label="NCBI BLAST query" value="ncbi_blast" />
        {hasPreloadedDatasets ? (
          <Tab label="Pre-loaded MSA datasets" value="preloaded_msa" />
        ) : null}
        <Tab label="Manual upload" value="manual_msa" />
      </Tabs>
      <TabPanel value={value} index="ncbi_blast">
        <NCBIBlastPanel
          handleClose={handleClose}
          feature={feature}
          model={model}
        />
      </TabPanel>
      {hasPreloadedDatasets ? (
        <TabPanel value={value} index="preloaded_msa">
          <PreLoadedMSA
            model={model}
            feature={feature}
            handleClose={handleClose}
          />
        </TabPanel>
      ) : null}
      <TabPanel value={value} index="manual_msa">
        <ManualMSALoader
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </TabPanel>
    </Dialog>
  )
}
