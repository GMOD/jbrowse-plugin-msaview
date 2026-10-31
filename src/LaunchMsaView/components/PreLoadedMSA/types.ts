import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { JBrowseConfigModel } from '@jbrowse/core/util'

export interface Dataset {
  datasetId: string
  name: string
  description?: string
  adapter: AnyConfigurationModel
}

// `msa` is this plugin's rootConfigurationSchema, which the host mounts beside
// JBrowseConfigModel's declared members, so the core type does not name it
export function readMsaDatasets(
  jbrowse: JBrowseConfigModel & { msa?: AnyConfigurationModel },
) {
  return jbrowse.msa
    ? (readConfObject(jbrowse.msa, 'datasets') as Dataset[] | undefined)
    : undefined
}
