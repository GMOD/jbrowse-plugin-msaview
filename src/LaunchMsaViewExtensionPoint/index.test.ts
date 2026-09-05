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

test('one field set is enough to need init', () => {
  const snapshot = launch({ data: { msa: '>a\nMEEP' }, querySeqName: 'QUERY' })
  expect(snapshot.init).toEqual({
    msaUrl: undefined,
    msaIndexedLocation: undefined,
    msaName: undefined,
    querySeqName: 'QUERY',
  })
})
