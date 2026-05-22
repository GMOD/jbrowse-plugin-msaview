import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

interface MsaDataAdapter {
  getMSAList(): Promise<string[]>
  getMSA(msaId: string): Promise<Feature[]>
}

async function getMsaAdapter(
  pluginManager: PluginManager,
  config: AnyConfigurationModel,
) {
  const result = await getAdapter(pluginManager, 'msa', config)
  return result.dataAdapter as unknown as MsaDataAdapter
}

export async function fetchMSAList({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}): Promise<string[]> {
  const adapter = await getMsaAdapter(pluginManager, config)
  return adapter.getMSAList()
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
  const adapter = await getMsaAdapter(pluginManager, config)
  return adapter.getMSA(msaId)
}
