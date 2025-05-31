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
  const adapter = (await getAdapter(pluginManager, 'msa', config)).dataAdapter

  // @ts-expect-error
  return adapter.getMSAList()
}
