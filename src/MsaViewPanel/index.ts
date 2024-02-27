import { lazy } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

// locals
import stateModelFactory from './model'

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
