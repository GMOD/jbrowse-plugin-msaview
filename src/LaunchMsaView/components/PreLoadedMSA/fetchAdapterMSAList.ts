import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type PluginManager from '@jbrowse/core/PluginManager'

export async function fetchAdapterMSAList({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  const result = await getAdapter(pluginManager, 'msa', config)

  // @ts-expect-error
  return result.dataAdapter.getMSAList()
}
