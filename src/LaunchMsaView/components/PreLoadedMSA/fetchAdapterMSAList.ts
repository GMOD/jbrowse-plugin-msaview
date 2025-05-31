import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { isStateTreeNode } from 'mobx-state-tree'

import type PluginManager from '@jbrowse/core/PluginManager'

export async function fetchAdapterMSAList({
  config,
  pluginManager,
}: {
  config: AnyConfigurationModel
  pluginManager: PluginManager
}) {
  console.log('wtfPREEEE', config)
  const adapter = await getAdapter(pluginManager, 'msa', config)
  console.log('wtfPOSSTTTTT', config)
  // @ts-expect-error
  return adapter.getMSAList()
}
//
// async function getAdapter(
//   pluginManager: PluginManager,
//   config: AnyConfigurationModel,
// ): Promise<BaseAdapter> {
//   // instantiate the data adapter's config schema so it gets its defaults,
//   // callbacks, etc
//   const type = pluginManager.getAdapterType(config.type)!
//   const adapterConfig = isStateTreeNode(config)
//     ? config
//     : type.configSchema.create(config, {
//         pluginManager,
//       })
//
//   const CLASS = await type.getAdapterClass()
//   return new CLASS(
//     adapterConfig,
//     // @ts-expect-error
//     c => (c ? getAdapter(pluginManager, c) : undefined),
//     pluginManager,
//   )
// }
