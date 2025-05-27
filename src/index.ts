import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import GridOn from '@mui/icons-material/GridOn'

import { version } from '../package.json'
import AddHighlightModelF from './AddHighlightModel'
import LaunchMsaViewF from './LaunchMsaView'
import MsaViewF from './MsaViewPanel'
import { types } from 'mobx-state-tree'
import {
  ConfigurationSchema,
  readConfObject,
} from '@jbrowse/core/configuration'

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
      console.log(readConfObject(pluginManager.rootModel.jbrowse.msa))
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
          }),
        ),
      ),
    }),
  }
}
