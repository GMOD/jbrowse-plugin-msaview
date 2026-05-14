import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { firstValueFrom, toArray } from 'rxjs'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class BgzipFastaMsaAdapter extends BaseAdapter {
  configureP: Promise<BaseFeatureDataAdapter> | undefined

  refNamesP: Promise<string[]> | undefined

  async configurePre() {
    const getSubAdapter = this.getSubAdapter
    if (getSubAdapter) {
      const adapter = await getSubAdapter({
        ...readConfObject(this.config),
        type: 'BgzipFastaAdapter',
      })

      return adapter.dataAdapter as BaseFeatureDataAdapter
    } else {
      throw new Error('no get subadapter')
    }
  }
  configure() {
    this.configureP ??= this.configurePre().catch((e: unknown) => {
      this.configureP = undefined
      throw e
    })
    return this.configureP
  }

  async getMSARefs() {
    this.refNamesP ??= this.configure()
      .then(adapter => adapter.getRefNames())
      .catch((e: unknown) => {
        this.refNamesP = undefined
        throw e
      })
    return this.refNamesP
  }

  getMsaRegex() {
    return new RegExp(this.getConf('msaRegex'))
  }

  refNameToMsaId(refName: string) {
    return refName.split(this.getMsaRegex())[0]!
  }

  async getMSAList() {
    const refNames = await this.getMSARefs()
    const list = new Set(refNames.map(name => this.refNameToMsaId(name)))
    return [...list]
  }

  async getMSA(id: string) {
    const adapter = await this.configure()
    const refNames = await adapter.getRefNames()
    const rows = refNames.filter(refName => this.refNameToMsaId(refName) === id)
    return firstValueFrom(
      adapter
        .getFeaturesInMultipleRegions(
          rows.map(refName => ({
            refName,
            start: 0,
            end: 1_000_000_000,
            assemblyName: '',
          })),
        )
        .pipe(toArray()),
    )
  }
}
