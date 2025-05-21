import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import { Tab, Tabs } from '@mui/material'

import EnsemblGeneTree from './EnsemblGeneTree/EnsemblGeneTree'
import MSALoader from './MSALoader/MSALoader'
import NCBIBlastQueryPanel from './NCBIBlastQuery/NCBIBlastPanel'
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
        <Tab label="NCBI BLAST" value={0} />
        <Tab label="UCSC 100-way dataset" value={1} />
        <Tab label="Ensembl GeneTree" value={2} />
        <Tab label="Open MSA" value={3} />
      </Tabs>
      <TabPanel value={value} index={0}>
        <NCBIBlastQueryPanel
          handleClose={arg => {
            if (arg) {
              setValue(3)
            } else {
              handleClose()
            }
          }}
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
      <TabPanel value={value} index={2}>
        <EnsemblGeneTree
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </TabPanel>
      <TabPanel value={value} index={3}>
        <MSALoader model={model} feature={feature} handleClose={handleClose} />
      </TabPanel>
    </Dialog>
  )
}
