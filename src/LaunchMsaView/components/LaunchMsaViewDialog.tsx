import React, { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Tab, Tabs } from '@mui/material'

import BlastPanel from './BlastQuery/BlastPanel'
import HelpButton from './HelpButton'
import ManualMSALoader from './ManualMSALoader/ManualMSALoader'
import OrthologPanel from './OrthologQuery/OrthologPanel'
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

  // orthologs first, and the default: it answers the same question in ~10s
  // that BLAST takes 10+ minutes to answer worse (see utils/ncbiOrthologs.ts)
  const [value, setValue] = useState<
    'orthologs' | 'ncbi_blast' | 'preloaded_msa' | 'manual_msa'
  >('orthologs')

  return (
    <Dialog maxWidth="xl" title="Launch MSA view" open onClose={handleClose}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Tabs
          value={value}
          onChange={(_event, newValue) => {
            setValue(newValue)
          }}
        >
          <Tab label="Orthologs" value="orthologs" />
          {/* the tab value stays 'ncbi_blast' — it is only local state, and
              renaming it buys nothing */}
          <Tab label="BLAST query" value="ncbi_blast" />
          {hasPreloadedDatasets ? (
            <Tab label="Pre-loaded MSA datasets" value="preloaded_msa" />
          ) : null}
          <Tab label="Manual upload" value="manual_msa" />
        </Tabs>
        <HelpButton />
      </div>
      <TabPanel value={value} index="orthologs">
        <OrthologPanel
          handleClose={handleClose}
          feature={feature}
          model={model}
        />
      </TabPanel>
      <TabPanel value={value} index="ncbi_blast">
        <BlastPanel handleClose={handleClose} feature={feature} model={model} />
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
