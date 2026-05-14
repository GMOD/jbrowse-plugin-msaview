import { readConfObject } from '@jbrowse/core/configuration'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface Dataset {
  datasetId: string
  name: string
  description?: string
  adapter: AnyConfigurationModel
}

export function readMsaDatasets(jbrowse: AnyConfigurationModel) {
  return readConfObject(jbrowse, ['msa', 'datasets']) as Dataset[] | undefined
}
