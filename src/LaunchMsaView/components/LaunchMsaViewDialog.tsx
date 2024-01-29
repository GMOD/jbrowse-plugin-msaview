import React, { useState } from 'react'
import { Dialog } from '@jbrowse/core/ui'
import { Box, Tab, Tabs } from '@mui/material'
import { AbstractTrackModel, Feature } from '@jbrowse/core/util'

// locals

import { CustomTabPanel, a11yProps } from './TabUtils'
import NCBIBlastPanel from './NCBIBlast/NCBIBlastPanel'
import PreLoadedMSA from './PreLoadedMSA/PreLoadedMSADataPanel'

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
      onClose={() => handleClose()}
      open
    >
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={value} onChange={(_, val) => setValue(val)}>
          <Tab label="NCBI BLAST" {...a11yProps(0)} />
          <Tab label="Pre-loaded dataset" {...a11yProps(1)} />
        </Tabs>
      </Box>
      <CustomTabPanel value={value} index={0}>
        <NCBIBlastPanel
          handleClose={handleClose}
          feature={feature}
          model={model}
        />
      </CustomTabPanel>
      <CustomTabPanel value={value} index={1}>
        <PreLoadedMSA
          model={model}
          feature={feature}
          handleClose={handleClose}
        />
      </CustomTabPanel>
    </Dialog>
  )
}
