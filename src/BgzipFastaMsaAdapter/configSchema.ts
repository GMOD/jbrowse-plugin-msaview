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
      msaIndexLocation: {
        type: 'fileLocation',
        description:
          '`.idx` of name, offset and length per alignment, which lists the set and reads each alignment as one block in place of the per-row .fai. Found beside the FASTA when unset',
        defaultValue: { uri: '', locationType: 'UriLocation' },
      },
    },
    {
      baseConfiguration: base.configSchema,
    },
  )
}
