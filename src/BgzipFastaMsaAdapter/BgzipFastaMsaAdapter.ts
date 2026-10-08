import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { firstValueFrom, toArray } from 'rxjs'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export default class BgzipFastaMsaAdapter extends BaseAdapter {
  configureP: Promise<BaseFeatureDataAdapter> | undefined

  msaRowsP: Promise<Map<string, string[]>> | undefined

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

  async groupRows() {
    const adapter = await this.configure()
    const separator = new RegExp(this.getConf('msaRegex'))
    const rows = new Map<string, string[]>()
    for (const refName of await adapter.getRefNames()) {
      const msaId = refName.split(separator)[0]!
      const group = rows.get(msaId)
      if (group) {
        group.push(refName)
      } else {
        rows.set(msaId, [refName])
      }
    }
    return rows
  }

  getMSARows() {
    this.msaRowsP ??= this.groupRows().catch((e: unknown) => {
      this.msaRowsP = undefined
      throw e
    })
    return this.msaRowsP
  }

  async getMSAList() {
    return [...(await this.getMSARows()).keys()]
  }

  async getMSA(id: string) {
    const adapter = await this.configure()
    const rows = (await this.getMSARows()).get(id) ?? []
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
