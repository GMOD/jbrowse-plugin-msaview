import React, { useState } from 'react'

import NCBIBlastAutomaticPanel from './NCBIBlastAutomaticPanel'
import NCBIBlastManualPanel from './NCBIBlastManualPanel'
import NCBIBlastMethodSelector from './NCBIBlastMethodSelector'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

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
  return (
    <>
      {lookupMethod === 'automatic' ? (
        <NCBIBlastAutomaticPanel
          model={model}
          feature={feature}
          handleClose={handleClose}
        >
          <NCBIBlastMethodSelector
            lookupMethod={lookupMethod}
            setLookupMethod={setLookupMethod}
          />
        </NCBIBlastAutomaticPanel>
      ) : null}
      {lookupMethod === 'manual' ? (
        <NCBIBlastManualPanel
          model={model}
          feature={feature}
          handleClose={handleClose}
        >
          <NCBIBlastMethodSelector
            lookupMethod={lookupMethod}
            setLookupMethod={setLookupMethod}
          />
        </NCBIBlastManualPanel>
      ) : null}
    </>
  )
}
