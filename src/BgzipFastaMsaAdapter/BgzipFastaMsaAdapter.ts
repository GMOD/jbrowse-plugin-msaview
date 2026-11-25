import { BgzfFilehandle } from '@gmod/bgzf-filehandle'
import { readConfObject } from '@jbrowse/core/configuration'
import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'
import { firstValueFrom, toArray } from 'rxjs'

import { isMissingFile } from '../OrthoFinderMsaAdapter/parseResults'
import { parseMsaIndex, readMsaEntry } from '../utils/msaIndex'

import type { MsaIndexEntry } from '../utils/msaIndex'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { FileLocation } from '@jbrowse/core/util'

export default class BgzipFastaMsaAdapter extends BaseAdapter {
  configureP: Promise<BaseFeatureDataAdapter> | undefined

  msaRowsP: Promise<Map<string, string[]>> | undefined

  msaIndexP: Promise<Map<string, MsaIndexEntry> | undefined> | undefined

  bgzf: BgzfFilehandle | undefined

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
  // `.fai` and `.gzi`; only one named in the config is required to exist. One
  // that failed to load for another reason is asked for again next time
  async loadMsaIndex() {
    const configured: FileLocation = this.getConf('msaIndexLocation')
    const adapter = await this.configure()
    const beside = withSuffix(adapter.getConf('fastaLocation'), '.idx')
    return 'uri' in configured && !configured.uri
      ? beside
        ? this.readMsaIndex(beside).catch((e: unknown) => {
            if (!isMissingFile(e)) {
              this.msaIndexP = undefined
            }
            return undefined
          })
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

  async getBgzf() {
    const adapter = await this.configure()
    this.bgzf ??= new BgzfFilehandle({
      filehandle: openLocation(
        adapter.getConf('fastaLocation'),
        this.pluginManager,
      ),
      gziFilehandle: openLocation(
        adapter.getConf('gziLocation'),
        this.pluginManager,
      ),
    })
    return this.bgzf
  }

  async readRowsMSA(rows: string[]) {
    const adapter = await this.configure()
    const features = await Promise.all(
      rows.map(refName =>
        firstValueFrom(
          adapter
            .getFeatures({
              refName,
              start: 0,
              end: 1_000_000_000,
              assemblyName: '',
            })
            .pipe(toArray()),
        ),
      ),
    )
    return features
      .flat()
      .map(f => `>${f.get('refName')}\n${f.get('seq')}`)
      .join('\n')
  }

  async getMSA(id: string) {
    const index = await this.getMsaIndex()
    const entry = index?.get(id)
    const rows = index ? undefined : (await this.getMSARows()).get(id)
    if (entry) {
      return { msa: await readMsaEntry(await this.getBgzf(), entry) }
    } else if (rows) {
      return { msa: await this.readRowsMSA(rows) }
    } else {
      throw new Error(`${id} is not an alignment in this dataset`)
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
