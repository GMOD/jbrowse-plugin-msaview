import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface DatasetMsa {
  msa: string
  tree?: string
  /** the row the dataset names as the protein's own, preferred over a row that matches it equally */
  queryRowName?: string
}

// the assembly is the one the launching genome view shows, which a dataset
// spanning several species reads its ids for
interface MsaDataAdapter {
  getMSAList(assemblyName?: string): Promise<string[]>
  getMSA(msaId: string, assemblyName?: string): Promise<DatasetMsa>
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
  assemblyName,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
  assemblyName?: string
}) {
  const adapter = await getMsaAdapter(pluginManager, config)
  return adapter.getMSAList(assemblyName)
}

export async function fetchMSA({
  config,
  pluginManager,
  msaId,
  assemblyName,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
  msaId: string
  assemblyName?: string
}) {
  const adapter = await getMsaAdapter(pluginManager, config)
  return adapter.getMSA(msaId, assemblyName)
}
