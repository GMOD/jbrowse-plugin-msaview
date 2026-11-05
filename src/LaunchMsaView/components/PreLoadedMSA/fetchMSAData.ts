import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface DatasetMsa {
  msa: string
  tree?: string
}

interface MsaDataAdapter {
  getMSAList(): Promise<string[]>
  getMSA(msaId: string): Promise<DatasetMsa>
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
}) {
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
}) {
  const adapter = await getMsaAdapter(pluginManager, config)
  return adapter.getMSA(msaId)
}
