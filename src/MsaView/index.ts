import PluginManager from '@jbrowse/core/PluginManager'
import { MSAView } from 'react-msaview'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import stateModelFactory from './model'

export default function MsaViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'MsaView',
        stateModel: stateModelFactory(),
        ReactComponent: MSAView,
      }),
  )
}
