import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { AbstractSessionModel, isAbstractMenuManager } from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import GridOn from '@mui/icons-material/GridOn'

import AddHighlightModelF from './AddHighlightModel'
import BgzipFastaMsaAdapterF from './BgzipFastaMsaAdapter'
import LaunchMsaViewF from './LaunchMsaView'
import LaunchMsaViewExtensionPointF from './LaunchMsaViewExtensionPoint'
import MsaViewF from './MsaViewPanel'
import { version } from './version'

export default class MsaViewPlugin extends Plugin {
  name = 'MsaViewPlugin'
  version = version

  install(pluginManager: PluginManager) {
    MsaViewF(pluginManager)
    LaunchMsaViewF(pluginManager)
    LaunchMsaViewExtensionPointF(pluginManager)
    AddHighlightModelF(pluginManager)
    BgzipFastaMsaAdapterF(pluginManager)
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

  // @ts-expect-error
  rootConfigurationSchema(pluginManager: PluginManager) {
    return {
      msa: ConfigurationSchema('MSA', {
        datasets: types.maybe(
          types.array(
            ConfigurationSchema('MSAEntry', {
              datasetId: {
                type: 'string',
                defaultValue: '',
              },
              description: {
                type: 'string',
                defaultValue: '',
              },
              name: {
                type: 'string',
                defaultValue: '',
              },
              adapter: pluginManager.pluggableConfigSchemaType('adapter'),
            }),
          ),
        ),
      }),
    }
  }
}
