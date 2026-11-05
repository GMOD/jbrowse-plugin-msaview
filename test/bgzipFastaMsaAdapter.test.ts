import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { expect, test } from 'vitest'

import BgzipFastaMsaAdapter from '../src/BgzipFastaMsaAdapter/BgzipFastaMsaAdapter'
import configSchemaF from '../src/BgzipFastaMsaAdapter/configSchema'

import type { Region } from '@jbrowse/core/util'

const fixture = (name: string) => ({
  localPath: path.join(import.meta.dirname, 'fixtures/msaIndex', name),
  locationType: 'LocalPathLocation' as const,
})

// stands in for the host's BgzipFastaAdapter, serving the rows a .fai would
const faiRows: Record<string, string> = {
  GENEA_hg38: 'MKVL',
  GENEA_mm10: 'MKIL',
  GENEC_hg38: 'PEST',
}

class FastaStub extends BaseFeatureDataAdapter {
  async getRefNames() {
    return Object.keys(faiRows)
  }

  getFeatures({ refName }: Region) {
    return ObservableCreate<SimpleFeature>(observer => {
      observer.next(
        new SimpleFeature({
          uniqueId: refName,
          refName,
          start: 0,
          end: 4,
          seq: faiRows[refName],
        }),
      )
      observer.complete()
    })
  }

  freeResources() {}
}

function makeAdapter(conf: Record<string, unknown>, fasta = 'genes.fa.gz') {
  const fastaSchema = ConfigurationSchema('BgzipFastaAdapter', {
    fastaLocation: { type: 'fileLocation', defaultValue: fixture(fasta) },
    gziLocation: {
      type: 'fileLocation',
      defaultValue: fixture(`${fasta}.gzi`),
    },
  })
  const pluginManager = new PluginManager()
  pluginManager.addAdapterType(
    () =>
      new AdapterType({
        name: 'BgzipFastaAdapter',
        configSchema: fastaSchema,
        getAdapterClass: async () => FastaStub,
      }),
  )
  pluginManager.createPluggableElements()
  return new BgzipFastaMsaAdapter(
    configSchemaF(pluginManager).create(conf),
    async () => ({
      dataAdapter: new FastaStub(fastaSchema.create()),
      sessionIds: new Set<string>(),
    }),
    pluginManager,
  )
}

test('an .idx beside the FASTA lists the set, and an alignment spanning bgzip blocks reads whole', async () => {
  const adapter = makeAdapter({})
  expect(await adapter.getMSAList()).toEqual(['GENEA', 'GENEB.2', 'GENEC'])

  const rows = (await adapter.getMSA('GENEB.2')).msa.split('\n')
  expect(rows.filter(r => r.startsWith('>'))).toEqual([
    '>GENEB.2_hg38',
    '>GENEB.2_panTro4',
    '>GENEB.2_mm10',
    '>GENEB.2_galGal6',
  ])
  expect(rows[1]).toBe(`${'WYHQ'.repeat(7500)}H`)
  expect(rows[7]).toBe(`${'WYHQ'.repeat(7500)}G`)
})

test('an id missing from the .idx reads as no alignment', async () => {
  expect(await makeAdapter({}).getMSA('NOPE')).toEqual({ msa: '' })
})

test('a configured .idx is used in place of the one beside the FASTA', async () => {
  const adapter = makeAdapter({
    msaIndexLocation: fixture('genes.fa.gz.idx'),
  })
  expect(await adapter.getMSAList()).toEqual(['GENEA', 'GENEB.2', 'GENEC'])
})

test('a configured .idx that is missing is an error, not a silent .fai read', async () => {
  const adapter = makeAdapter({ msaIndexLocation: fixture('missing.idx') })
  await expect(adapter.getMSAList()).rejects.toThrow('ENOENT')
})

test('without an .idx beside the FASTA, the rows are grouped from the .fai names', async () => {
  const adapter = makeAdapter({}, 'no-index.fa.gz')
  expect(await adapter.getMSAList()).toEqual(['GENEA', 'GENEC'])
  expect(await adapter.getMSA('GENEA')).toEqual({
    msa: '>GENEA_hg38\nMKVL\n>GENEA_mm10\nMKIL',
  })
})
