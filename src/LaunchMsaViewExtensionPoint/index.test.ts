import { expect, test } from 'vitest'

import LaunchMsaViewExtensionPointF from './index'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

function launch(args: Record<string, unknown>) {
  let run: ((args: unknown) => unknown) | undefined
  LaunchMsaViewExtensionPointF({
    addToExtensionPoint(_name: string, cb: (args: unknown) => unknown) {
      run = cb
    },
  } as unknown as PluginManager)
  const added: Record<string, unknown>[] = []
  const session = {
    addView(_type: string, snapshot: Record<string, unknown>) {
      added.push(snapshot)
      return { id: 'view-1' }
    },
  } as unknown as AbstractSessionModel
  run!({ session, ...args })
  return added[0]!
}

test('inline data carries no init, which the panel would read as a launch in flight', () => {
  const snapshot = launch({ data: { msa: '>a\nMEEP' } })
  expect('init' in snapshot).toBe(false)
})

test('a file location travels through init', () => {
  const snapshot = launch({
    msaFileLocation: { uri: 'http://example.com/a.fa' },
  })
  expect(snapshot.init).toEqual({
    msaUrl: 'http://example.com/a.fa',
    msaIndexedLocation: undefined,
    msaName: undefined,
    querySeqName: undefined,
  })
})

test('searchParams is a source, stored under the name the dialog uses', () => {
  const snapshot = launch({
    searchParams: {
      searchProgram: 'phmmer',
      blastDatabase: 'rp15',
      accession: 'P04637',
    },
    connectedViewId: 'lgv1',
    connectedTranscript: 'NM_000546.6',
  })
  expect(snapshot.blastParams).toEqual({
    searchProgram: 'phmmer',
    blastDatabase: 'rp15',
    accession: 'P04637',
  })
  expect('searchParams' in snapshot).toBe(false)
  expect(snapshot.connectedTranscript).toBe('NM_000546.6')
})

test('a launch naming no source at all is refused', () => {
  expect(() => launch({ connectedViewId: 'lgv1' })).toThrow(/searchParams/)
})

test('region and the data-layer keys reach the view as snapshot properties', () => {
  const region = { row: 'Human', start: 245, end: 249 }
  const clades = [{ mrca: ['Human', 'Mouse'], tips: 2, mark: 'bracket' }]
  const snapshot = launch({
    data: { msa: '>Human\nMEEP' },
    region,
    clades,
    relativeTo: 'Human',
    gffFilehandle: { uri: 'http://example.com/a.gff' },
  })
  expect(snapshot.region).toEqual(region)
  expect(snapshot.clades).toEqual(clades)
  expect(snapshot.relativeTo).toBe('Human')
  expect(snapshot.gffFilehandle).toEqual({ uri: 'http://example.com/a.gff' })
})

test('one field set is enough to need init', () => {
  const snapshot = launch({ data: { msa: '>a\nMEEP' }, querySeqName: 'QUERY' })
  expect(snapshot.init).toEqual({
    msaUrl: undefined,
    msaIndexedLocation: undefined,
    msaName: undefined,
    querySeqName: 'QUERY',
  })
})

test('msa and tree urls reach the plugin sources, query the query row', () => {
  const snapshot = launch({
    msa: 'https://example.com/p53.afa',
    tree: 'https://example.com/p53.nh',
    query: 'Human',
  })
  expect(snapshot.init).toMatchObject({
    msaUrl: 'https://example.com/p53.afa',
    querySeqName: 'Human',
  })
  expect(snapshot.treeFilehandle).toEqual({
    uri: 'https://example.com/p53.nh',
    locationType: 'UriLocation',
  })
  expect(snapshot.relativeTo).toBe('Human')
  expect('msa' in snapshot || 'query' in snapshot).toBe(false)
})

test('inline msa and newick text become inline data', () => {
  const snapshot = launch({ msa: '>a\nMEEP\n>b\nMEEP', tree: '(a,b);' })
  expect(snapshot.data).toEqual({ msa: '>a\nMEEP\n>b\nMEEP', tree: '(a,b);' })
  expect('init' in snapshot).toBe(false)
})

test('highlights, region and column tracks expand onto the query row', () => {
  const snapshot = launch({
    msa: 'https://example.com/p53.afa',
    query: 'Human',
    highlights: ['102-292 DNA-binding', 175],
    region: '170-290',
    columnTracks: [{ name: 'ClinVar', start: 3, values: [2, 1] }],
  })
  expect(snapshot.highlights).toEqual([
    { row: 'Human', start: 102, end: 292, label: 'DNA-binding' },
    { row: 'Human', start: 175, end: 175, label: '{residue}{position}' },
  ])
  expect(snapshot.region).toEqual({ row: 'Human', start: 170, end: 290 })
  expect(snapshot.columnTracks).toEqual([
    {
      id: 'clinvar',
      name: 'ClinVar',
      kind: 'bar',
      row: 'Human',
      values: [0, 0, 2, 1],
    },
  ])
})
