import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'

export default function configSchemaF(pluginManager: PluginManager) {
  const base = pluginManager.getAdapterType('BgzipFastaAdapter')
  return ConfigurationSchema(
    'BgzipFastaMsaAdapter',
    {
      regex: {
        type: 'string',
        defaultValue: '_',
      },
    },
    {
      baseConfiguration: base?.configSchema,
    },
  )
}
