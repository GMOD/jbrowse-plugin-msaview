import PluginManager from '@jbrowse/core/PluginManager'
import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchemaF from './configSchema'

export default function BgzipFastaMsaAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'BgzipFastaMsaAdapter',
      configSchema: configSchemaF(pluginManager),
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      getAdapterClass: () =>
        import('./BgzipFastaMsaAdapter').then(t => t.default),
    })
  })
}
