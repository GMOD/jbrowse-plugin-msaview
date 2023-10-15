import PluginManager from '@jbrowse/core/PluginManager'
import { MSAView } from 'react-msaview'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

import stateModel from './model'

export default function MsaViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'MsaView',
        stateModel: stateModel,
        ReactComponent: MSAView,
      }),
  )
}
