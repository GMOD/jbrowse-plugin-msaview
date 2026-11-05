import { AdapterType } from '@jbrowse/core/pluggableElementTypes'

import configSchemaF from './configSchema'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function OrthoFinderMsaAdapterF(pluginManager: PluginManager) {
  return pluginManager.addAdapterType(() => {
    return new AdapterType({
      name: 'OrthoFinderMsaAdapter',
      configSchema: configSchemaF(),
      adapterMetadata: {
        hiddenFromGUI: true,
      },
      getAdapterClass: () =>
        import('./OrthoFinderMsaAdapter').then(t => t.default),
    })
  })
}
