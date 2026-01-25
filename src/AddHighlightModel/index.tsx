import React from 'react'

import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'

import HighlightComponents from './HighlightComponents'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export default function AddHighlightComponentsModelF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (rest: React.ReactNode[], { model }: { model: LinearGenomeViewModel }) => {
      // Quick check: don't add any components if no MSA view exists
      const { views } = getSession(model)
      const hasMsaView = views.some(v => v.type === 'MsaView')
      if (!hasMsaView) {
        return rest
      }

      return [
        ...rest,
        <HighlightComponents
          key="highlight_protein_viewer_msaview"
          model={model}
        />,
      ]
    },
  )
}
