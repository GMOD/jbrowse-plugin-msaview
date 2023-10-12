import PluginManager from '@jbrowse/core/PluginManager'
import * as MSA from 'react-msaview'
import ViewType from '@jbrowse/core/pluggableElementTypes/ViewType'

export default function MsaViewF(pluginManager: PluginManager) {
  pluginManager.addViewType(
    () =>
      new ViewType({
        name: 'MsaView',
        //@ts-expect-error
        stateModel: MSA.MSAModel,
        ReactComponent: MSA.MSAView,
      }),
  )
}
