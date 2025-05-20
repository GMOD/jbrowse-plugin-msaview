import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import { Tab, Tabs } from '@mui/material'

import NewNcbiBlastQueryPanel from './NewNCBIBlastQuery'
import PreLoadedMSA from './PreLoadedMSA/PreLoadedMSADataPanel'
import TabPanel from './TabPanel'

export default function LaunchProteinViewDialog({
  handleClose,
  feature,
  model,
}: {
  handleClose: () => void
  feature: Feature
  model: AbstractTrackModel
}) {
  const [value, setValue] = useState(0)

  return (
    <Dialog
      maxWidth="xl"
      title="Launch MSA view"
      open
      onClose={() => {
        handleClose()
      }}
    >
      <Tabs
        value={value}
        onChange={(_, val) => {
          setValue(val)
        }}
      >
        <Tab label="NCBI BLAST query" value={0} />
        <Tab label="UCSC 100-way dataset" value={1} />
      </Tabs>
      <TabPanel value={value} index={0}>
        <NewNcbiBlastQueryPanel
          handleClose={handleClose}
          feature={feature}
          model={model}
        />
      </TabPanel>
      <TabPanel value={value} index={1}>
        <PreLoadedMSA
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </TabPanel>
    </Dialog>
  )
}
