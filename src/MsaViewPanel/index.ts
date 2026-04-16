import { lazy } from 'react'

import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import stateModelFactory from './model'

import type PluginManager from '@jbrowse/core/PluginManager'

// lazies
const MsaViewPanel = lazy(() => import('./components/MsaViewPanel'))

export default function MsaViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(() => {
    return new ViewType({
      name: 'MsaView',
      stateModel: stateModelFactory(),
      ReactComponent: MsaViewPanel,
    })
  })
}
