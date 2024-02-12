import React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import HighlightComponents from './HighlightComponents'

export default function AddHighlightComponentsModelF(
  pluginManager: PluginManager,
) {
  pluginManager.addToExtensionPoint(
    'LinearGenomeView-TracksContainerComponent',
    // @ts-expect-error
    (
      rest: React.ReactNode[] = [],
      { model }: { model: LinearGenomeViewModel },
    ) => {
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
