import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { firstValueFrom, toArray } from 'rxjs'

import { parseMsaIndex, readMsaBlock } from '../utils/msaIndex'

import type { MsaIndexEntry } from '../utils/msaIndex'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FileLocation } from '@jbrowse/core/util'

export default class BgzipFastaMsaAdapter extends BaseAdapter {
  configureP: Promise<BaseFeatureDataAdapter> | undefined

  msaRowsP: Promise<Map<string, string[]>> | undefined

  msaIndexP: Promise<Map<string, MsaIndexEntry> | undefined> | undefined

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

  async readMsaIndex(location: FileLocation) {
    const text = await openLocation(location, this.pluginManager).readFile(
      'utf8',
    )
    return new Map(parseMsaIndex(text).map(e => [e.name, e]))
  }

  // an `.idx` beside the FASTA is used when present, as the host finds the
  // `.fai` and `.gzi`; only one named in the config is required to exist
  async loadMsaIndex() {
    const configured: FileLocation = this.getConf('msaIndexLocation')
    const adapter = await this.configure()
    const beside = withSuffix(adapter.getConf('fastaLocation'), '.idx')
    return 'uri' in configured && !configured.uri
      ? beside
        ? this.readMsaIndex(beside).catch(() => undefined)
        : undefined
      : this.readMsaIndex(configured)
  }

  getMsaIndex() {
    this.msaIndexP ??= this.loadMsaIndex().catch((e: unknown) => {
      this.msaIndexP = undefined
      throw e
    })
    return this.msaIndexP
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
    return [...((await this.getMsaIndex()) ?? (await this.getMSARows())).keys()]
  }

  async readIndexedMSA(index: Map<string, MsaIndexEntry>, id: string) {
    const adapter = await this.configure()
    const entry = index.get(id)
    return entry
      ? readMsaBlock({
          filehandle: openLocation(
            adapter.getConf('fastaLocation'),
            this.pluginManager,
          ),
          gziFilehandle: openLocation(
            adapter.getConf('gziLocation'),
            this.pluginManager,
          ),
          entry,
        })
      : ''
  }

  async readRowsMSA(id: string) {
    const adapter = await this.configure()
    const rows = (await this.getMSARows()).get(id) ?? []
    const features = await firstValueFrom(
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
    return features.map(f => `>${f.get('refName')}\n${f.get('seq')}`).join('\n')
  }

  async getMSA(id: string) {
    const index = await this.getMsaIndex()
    return {
      msa: await (index
        ? this.readIndexedMSA(index, id)
        : this.readRowsMSA(id)),
    }
  }
}

function withSuffix(location: FileLocation, suffix: string) {
  return 'uri' in location
    ? { ...location, uri: `${location.uri}${suffix}` }
    : 'localPath' in location
      ? { ...location, localPath: `${location.localPath}${suffix}` }
      : undefined
}
