import React from 'react'

import { getSession } from '@jbrowse/core/util'

import { isMsaView } from '../MsaViewPanel/isMsaView'
import HighlightComponents from './HighlightComponents'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function AddHighlightComponentsModelF(
  pluginManager: PluginManager,
) {
  pluginManager.contributeToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    ({ model }) => {
      const { views } = getSession(model)
      return views.some(v => isMsaView(v) && v.connectedViewId === model.id) ? (
        <HighlightComponents
          key="highlight_protein_viewer_msaview"
          model={model}
        />
      ) : undefined
    },
  )
}
