import React, { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { Dialog } from '@jbrowse/core/ui'
import { AbstractTrackModel, Feature, getSession } from '@jbrowse/core/util'
import { Tab, Tabs } from '@mui/material'

import EnsemblGeneTree from './EnsemblGeneTree/EnsemblGeneTree'
import ManualMSALoader from './ManualMSALoader/ManualMSALoader'
import NCBIBlastPanel from './NCBIBlastQuery/NCBIBlastPanel'
import PreLoadedMSA from './PreLoadedMSA/PreLoadedMSADataPanel'
import TabPanel from './TabPanel'

import type { Dataset } from './PreLoadedMSA/types'

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
  const { jbrowse } = session
  const datasets = readConfObject(jbrowse, ['msa', 'datasets']) as
    | Dataset[]
    | undefined
  const hasPreloadedDatasets = datasets && datasets.length > 0

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
        <Tab label="Ensembl GeneTree" value="ensembl_genetree" />
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
      <TabPanel value={value} index="ensembl_genetree">
        <EnsemblGeneTree
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </TabPanel>
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
