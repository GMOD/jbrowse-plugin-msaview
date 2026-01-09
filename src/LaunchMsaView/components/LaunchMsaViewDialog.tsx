import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { AbstractTrackModel, Feature } from '@jbrowse/core/util'
import { Tab, Tabs } from '@mui/material'

import EnsemblGeneTree from './EnsemblGeneTree/EnsemblGeneTree'
import ManualMSALoader from './ManualMSALoader/ManualMSALoader'
import NCBIBlastPanel from './NCBIBlastQuery/NCBIBlastPanel'
import PreLoadedMSA from './PreLoadedMSA/PreLoadedMSADataPanel'
import TabPanel from './TabPanel'

const TABS = {
  NCBI_BLAST: 0,
  PRELOADED_MSA: 1,
  ENSEMBL_GENETREE: 2,
  MANUAL_MSA: 3,
}

export default function LaunchMsaViewDialog({
  handleClose,
  feature,
  model,
}: {
  handleClose: () => void
  feature: Feature
  model: AbstractTrackModel
}) {
  const [value, setValue] = useState(TABS.NCBI_BLAST)

  const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue)
  }

  return (
    <Dialog maxWidth="xl" title="Launch MSA view" open onClose={handleClose}>
      <Tabs value={value} onChange={handleChange}>
        <Tab label="NCBI BLAST query" value={TABS.NCBI_BLAST} />
        <Tab label="Pre-loaded MSA datasets" value={TABS.PRELOADED_MSA} />
        <Tab label="Ensembl GeneTree" value={TABS.ENSEMBL_GENETREE} />
        <Tab label="Manual upload" value={TABS.MANUAL_MSA} />
      </Tabs>
      <TabPanel value={value} index={TABS.NCBI_BLAST}>
        <NCBIBlastPanel
          handleClose={handleClose}
          feature={feature}
          model={model}
        />
      </TabPanel>
      <TabPanel value={value} index={TABS.PRELOADED_MSA}>
        <PreLoadedMSA
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </TabPanel>
      <TabPanel value={value} index={TABS.ENSEMBL_GENETREE}>
        <EnsemblGeneTree
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </TabPanel>
      <TabPanel value={value} index={TABS.MANUAL_MSA}>
        <ManualMSALoader
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </TabPanel>
    </Dialog>
  )
}
