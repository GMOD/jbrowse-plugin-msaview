import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import type PluginManager from '@jbrowse/core/PluginManager'

const MsaViewPanel = lazy(() => import('./components/MsaViewPanel'))

export default function MsaViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'MsaView',
      // a thunk, so react-msaview loads with the first view rather than with
      // the plugin; addView refuses the type until then, hence launchView
      stateModel: () => import('./model').then(m => m.default()),
      ReactComponent: MsaViewPanel,
    })
  })
}
