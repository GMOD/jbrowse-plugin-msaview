import { useState } from 'react'

import { getSession } from '@jbrowse/core/util'

import { launchMsaView } from '../../utils/launchMsaView'

import type { MsaViewPlacement } from '../../utils/workspaces'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

/** how a view whose alignment the plugin builds opens */
export const builtAlignmentLook = {
  drawNodeBubbles: true,
  colWidth: 10,
  rowHeight: 12,
}

/**
 * Every dialog launch: an MSA view tied to the genome view it came from, and
 * through `feature` to the transcript whose codons its query row is read by.
 */
export function launchConnectedView({
  view,
  feature,
  placement,
  ...snapshot
}: {
  view: LinearGenomeViewModel
  feature?: Feature
  placement: MsaViewPlacement
} & Record<string, unknown>) {
  launchMsaView(getSession(view), {
    placement,
    connectedViewId: view.id,
    connectedFeature: feature?.toJSON(),
    ...snapshot,
  })
}

/** runs a panel's launch, closing the dialog on success and keeping the error */
export function useLaunchSubmit(handleClose: () => void) {
  const [launchError, setLaunchError] = useState<unknown>()
  return {
    launchError,
    submit: (launch: () => void) => {
      try {
        setLaunchError(undefined)
        launch()
        handleClose()
      } catch (e) {
        console.error(e)
        setLaunchError(e)
      }
    },
  }
}
