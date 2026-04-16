import { ConfigurationSchema } from '@jbrowse/core/configuration'

import type PluginManager from '@jbrowse/core/PluginManager'

export default function configSchemaF(pluginManager: PluginManager) {
  const base = pluginManager.getAdapterType('BgzipFastaAdapter')
  return ConfigurationSchema(
    'BgzipFastaMsaAdapter',
    {
      msaRegex: {
        type: 'string',
        defaultValue: '_',
      },
    },
    {
      baseConfiguration: base?.configSchema,
    },
  )
}
