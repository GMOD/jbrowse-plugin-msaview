import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface Dataset {
  datasetId: string
  name: string
  description?: string
  adapter: AnyConfigurationModel
}
