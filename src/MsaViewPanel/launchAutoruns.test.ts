import { expect, test, vi } from 'vitest'

import { doLaunchBlast } from './doLaunchBlast'
import stateModelFactory from './model'

import type { JBrowsePluginMsaViewModel } from './model'

vi.mock('@jbrowse/core/util', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSession: () => ({ views: [], hovered: undefined }),
}))
vi.mock('./doLaunchBlast', () => ({ doLaunchBlast: vi.fn() }))
vi.mock('./msaDataStore', () => ({
  cleanupOldData: vi.fn(async () => {}),
  generateDataStoreId: vi.fn(),
  retrieveMsaData: vi.fn(),
  storeMsaData: vi.fn(),
}))

// the real launch reads querySeqName before its first await, as resolveQuery
// does, which used to make that name a reason to launch again
test('a write the launch body read does not start a second launch', () => {
  vi.mocked(doLaunchBlast).mockImplementation(
    ({ self }: { self: JBrowsePluginMsaViewModel }) => {
      void self.querySeqName
      return new Promise(() => {})
    },
  )
  const model = stateModelFactory().create({
    type: 'MsaView',
    id: 'msa1',
    blastParams: {
      searchProgram: 'blastp',
      blastDatabase: 'uniprotkb_swissprot',
      msaAlgorithm: 'clustalo',
      proteinSequence: 'MKV',
    },
  })
  expect(doLaunchBlast).toHaveBeenCalledTimes(1)

  model.setQuerySeqName('P53_HUMAN_query')

  expect(doLaunchBlast).toHaveBeenCalledTimes(1)
})
