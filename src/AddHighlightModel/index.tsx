import React from 'react'

import PluginManager from '@jbrowse/core/PluginManager'
import { getSession } from '@jbrowse/core/util'

import HighlightComponents from './HighlightComponents'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

let lastExtensionPointCall = 0

export default function AddHighlightComponentsModelF(
  _pluginManager: PluginManager,
) {
  // TEMPORARILY DISABLED - testing scroll performance
  // The extension point callback itself seems to cause stepwise scrolling
  console.log('[MSA-DEBUG] Extension point registration DISABLED for testing')
  return

  /*
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (rest: React.ReactNode[], { model }: { model: LinearGenomeViewModel }) => {
      const now = performance.now()
      const delta = now - lastExtensionPointCall
      lastExtensionPointCall = now

      // Log if called more frequently than 100ms
      if (delta < 100) {
        console.log(
          '[MSA-DEBUG] ExtensionPoint callback called rapidly',
          `delta=${delta.toFixed(1)}ms`,
          `offsetPx=${model.offsetPx}`,
        )
      }

      // Quick check: don't add any components if no MSA view exists
      const { views } = getSession(model)
      const hasMsaView = views.some(v => v.type === 'MsaView')
      if (!hasMsaView) {
        return rest
      }

      console.log('[MSA-DEBUG] Adding HighlightComponents, hasMsaView=true')

      return [
        ...rest,
        <HighlightComponents
          key="highlight_protein_viewer_msaview"
          model={model}
        />,
      ]
    },
  )
  */
}
