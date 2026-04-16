import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export async function fetchMSAList({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}): Promise<string[]> {
  const result = await getAdapter(pluginManager, 'msa', config)

  // @ts-expect-error
  return result.dataAdapter.getMSAList()
}

export async function fetchMSA({
  config,
  pluginManager,
  msaId,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
  msaId: string
}): Promise<Feature[]> {
  const result = await getAdapter(pluginManager, 'msa', config)

  // @ts-expect-error
  return result.dataAdapter.getMSA(msaId)
}
