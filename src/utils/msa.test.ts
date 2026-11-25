import { expect, test, vi } from 'vitest'

import { runEbiJob } from './ebiJobDispatcher'
import { launchMSA } from './msa'

vi.mock('./ebiJobDispatcher', () => ({ runEbiJob: vi.fn() }))

function jobReturning(tree: () => Promise<string>) {
  vi.mocked(runEbiJob).mockResolvedValue({
    jobId: 'job1',
    result: (type: string) =>
      type === 'phylotree' ? tree() : Promise.resolve('>a\nMK'),
  })
}

const launch = () =>
  launchMSA({ algorithm: 'mafft', sequence: '>a\nMK', onProgress: () => {} })

test('an alignment whose tree fetch failed is kept, with no tree', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  jobReturning(() => Promise.reject(new Error('HTTP 502')))
  expect(await launch()).toEqual({ msa: '>a\nMK', tree: '' })
})

test('a cancel during the tree fetch still ends the launch', async () => {
  jobReturning(() => Promise.reject(new DOMException('Aborted', 'AbortError')))
  await expect(launch()).rejects.toThrow('Aborted')
})
