import { readConfObject } from '@jbrowse/core/configuration'
import {
  BaseAdapter,
  BaseFeatureDataAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { firstValueFrom, toArray } from 'rxjs'

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
      if (!adapter) {
        throw new Error('Error getting subadapter')
      }
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
    if (!this.refNamesP) {
      console.log('wtf')
      this.refNamesP = this.configure()
        .then(adapter => adapter.getRefNames())
        .catch((e: unknown) => {
          this.refNamesP = undefined
          throw e
        })
    }
    return this.refNamesP
  }

  async getMSAList() {
    const refNames = await this.getMSARefs()
    const list = new Set<string>()
    const val = this.getConf('msaRegex')
    const re = new RegExp(val)
    for (let i = 0, l = refNames.length; i < l; i++) {
      list.add(refNames[i]!.split(re)[0]!)
    }
    return [...list]
  }

  async getMSA(id: string) {
    const adapter = await this.configure()
    console.log('wtf2')
    const refNames = await adapter.getRefNames()
    const rows = []
    for (let i = 0, l = refNames.length; i < l; i++) {
      const refName = refNames[i]!
      if (refName.startsWith(id)) {
        rows.push(refName)
      }
    }
    const ret = await firstValueFrom(
      adapter
        .getFeaturesInMultipleRegions(
          refNames.map(refName => ({
            refName,
            start: 0,
            end: 1_000_000_000,
            assemblyName: '',
          })),
        )
        .pipe(toArray()),
    )
    return ret
  }
}
