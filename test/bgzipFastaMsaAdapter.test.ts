import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'
import { SimpleFeature } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { expect, test, vi } from 'vitest'

import BgzipFastaMsaAdapter from '../src/BgzipFastaMsaAdapter/BgzipFastaMsaAdapter'
import configSchemaF from '../src/BgzipFastaMsaAdapter/configSchema'

import type { Region } from '@jbrowse/core/util'
import type { openLocation } from '@jbrowse/core/util/io'

const { gziReads } = vi.hoisted(() => ({ gziReads: { count: 0 } }))

vi.mock('@jbrowse/core/util/io', async importOriginal => {
  const io = await importOriginal<{ openLocation: typeof openLocation }>()
  return {
    ...io,
    openLocation: (...args: Parameters<typeof openLocation>) => {
      const filehandle = io.openLocation(...args)
      const location = args[0]
      if ('localPath' in location && location.localPath.endsWith('.gzi')) {
        const read = filehandle.read.bind(filehandle)
        filehandle.read = (...readArgs) => {
          gziReads.count += 1
          return read(...readArgs)
        }
      }
      return filehandle
    },
  }
})

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

  delayFor(_refName: string) {
    return 0
  }

  getFeatures({ refName }: Region) {
    return ObservableCreate<SimpleFeature>(async observer => {
      await new Promise(resolve => setTimeout(resolve, this.delayFor(refName)))
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

// the first row of each alignment answers last, as a slow range request would
class SlowFirstRowStub extends FastaStub {
  delayFor(refName: string) {
    return refName.endsWith('_hg38') ? 20 : 0
  }
}

function makeAdapter(
  conf: Record<string, unknown>,
  fasta = 'genes.fa.gz',
  Stub = FastaStub,
) {
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
        getAdapterClass: async () => Stub,
      }),
  )
  pluginManager.createPluggableElements()
  return new BgzipFastaMsaAdapter(
    configSchemaF(pluginManager).create(conf),
    async () => ({
      dataAdapter: new Stub(fastaSchema.create()),
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

test('an id missing from the .idx is named in an error, not an empty alignment', async () => {
  await expect(makeAdapter({}).getMSA('NOPE')).rejects.toThrow(
    'NOPE is not an alignment in this dataset',
  )
})

test('an id missing from the .fai names is an error too', async () => {
  await expect(
    makeAdapter({}, 'no-index.fa.gz').getMSA('NOPE'),
  ).rejects.toThrow('NOPE is not an alignment in this dataset')
})

test('reading several alignments reads the .gzi once', async () => {
  const adapter = makeAdapter({})
  gziReads.count = 0
  await adapter.getMSA('GENEA')
  const afterFirst = gziReads.count
  await adapter.getMSA('GENEB.2')
  await adapter.getMSA('GENEC')
  expect(afterFirst).toBeGreaterThan(0)
  expect(gziReads.count).toBe(afterFirst)
})

test('an .idx beside the FASTA that failed to load is not asked for again, so the list and the reads agree', async () => {
  const adapter = makeAdapter({})
  const read = adapter.readMsaIndex.bind(adapter)
  let failures = 1
  adapter.readMsaIndex = async location => {
    if (failures > 0) {
      failures -= 1
      throw new Error('Failed to fetch fetching genes.fa.gz.idx')
    }
    return read(location)
  }
  expect(await adapter.getMSAList()).toEqual(['GENEA', 'GENEC'])
  expect(await adapter.getMSAList()).toEqual(['GENEA', 'GENEC'])
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

test('rows read from the .fai keep its order, however the reads finish', async () => {
  const adapter = makeAdapter({}, 'no-index.fa.gz', SlowFirstRowStub)
  expect(await adapter.getMSA('GENEA')).toEqual({
    msa: '>GENEA_hg38\nMKVL\n>GENEA_mm10\nMKIL',
  })
})
