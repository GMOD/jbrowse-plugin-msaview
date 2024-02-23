import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'

// icons
import GridOn from '@mui/icons-material/GridOn'

// locals
import { version } from '../package.json'
import MsaViewF from './JBrowsePluginMsaView'
import LaunchMsaViewF from './LaunchMsaView'
import AddHighlightModelF from './AddHighlightModel'

export default class MsaViewPlugin extends Plugin {
  name = 'MsaViewPlugin'
  version = version

  install(pluginManager: PluginManager) {
    MsaViewF(pluginManager)
    LaunchMsaViewF(pluginManager)
    AddHighlightModelF(pluginManager)
  }

  configure(pluginManager: PluginManager) {
    if (isAbstractMenuManager(pluginManager.rootModel)) {
      pluginManager.rootModel.appendToSubMenu(['Add'], {
        label: 'Multiple sequence alignment view',
        icon: GridOn,
        onClick: (session: AbstractSessionModel) => {
          session.addView('MsaView', {})
        },
      })
    }
  }
}
