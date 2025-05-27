import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import GridOn from '@mui/icons-material/GridOn'
import { types } from 'mobx-state-tree'

import { version } from '../package.json'
import AddHighlightModelF from './AddHighlightModel'
import LaunchMsaViewF from './LaunchMsaView'
import MsaViewF from './MsaViewPanel'

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

  rootConfigurationSchema = {
    msa: ConfigurationSchema('MSA', {
      datasets: types.maybe(
        types.array(
          ConfigurationSchema('MSAEntry', {
            name: {
              type: 'string',
              defaultValue: '',
            },
            adapter: {
              type: 'frozen',
              description:
                'This can be a data adapter config for a IndexedFasta for example, which has a special way of being interpreted',
              defaultValue: {},
            },
          }),
        ),
      ),
    }),
  }
}
