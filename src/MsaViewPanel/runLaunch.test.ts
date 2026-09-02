import { describe, expect, test, vi } from 'vitest'

import { runLaunch } from './runLaunch'

import type { JBrowsePluginMsaViewModel } from './model'
import type { LaunchScope } from './runLaunch'

/**
 * A model that records every write, so "no model actions after abort" is
 * assertable rather than inferred. The real thing throws on a destroyed node;
 * here a write that should not have happened simply shows up in the log.
 */
function makeModel() {
  const writes: string[] = []
  const model = {
    launchController: undefined as AbortController | undefined,
    setLaunchController(arg?: AbortController) {
      model.launchController = arg
      writes.push(`setLaunchController:${arg ? 'set' : 'cleared'}`)
    },
    setProgress: (arg: string) => writes.push(`setProgress:${arg}`),
    setError: (e: unknown) =>
      writes.push(`setError:${e instanceof Error ? e.message : String(e)}`),
    setRid: (arg: string) => writes.push(`setRid:${arg}`),
    setData: () => writes.push('setData'),
  } as unknown as JBrowsePluginMsaViewModel & {
    launchController: AbortController | undefined
  }
  return { model, writes }
}

const DATA = { msa: '>a\nMK', tree: '(a);', treeMetadata: '{}' }

/** run the microtask queue out so the launch's async body has finished */
const settle = () => new Promise(res => setTimeout(res, 0))

describe('a launch that finishes', () => {
  test('applies its data, clears its params and releases the controller', async () => {
    const { model, writes } = makeModel()
    const onLaunched = vi.fn()

    runLaunch({
      self: model,
      message: 'Submitting query',
      onLaunched,
      launch: async scope => {
        scope.onRid('ncbiblast-1')
        scope.onProgress('Re-checking BLAST status in... 7')
        return DATA
      },
    })
    await settle()

    expect(writes).toEqual([
      'setLaunchController:set',
      'setProgress:Submitting query',
      'setError:undefined',
      'setRid:ncbiblast-1',
      'setProgress:Re-checking BLAST status in... 7',
      'setData',
      'setProgress:',
      'setLaunchController:cleared',
    ])
    expect(onLaunched).toHaveBeenCalled()
  })
})

// The failure this file exists for: closing a view mid-BLAST left the poller
// running for the job's lifetime and then writing to a destroyed
// mobx-state-tree node, whose throw surfaced as an unhandled rejection.
describe('a launch that is abandoned', () => {
  async function abandonMidFlight(reject: boolean) {
    const { model, writes } = makeModel()
    let released!: () => void
    const held = new Promise<void>(res => {
      released = res
    })
    let captured!: LaunchScope

    runLaunch({
      self: model,
      message: 'Submitting query',
      onLaunched: () => {
        throw new Error('a cancelled launch must not report success')
      },
      launch: async scope => {
        captured = scope
        await held
        // what the network hop does once its signal is aborted: either it
        // rejects with an AbortError, or it had already resolved and returns
        if (reject) {
          throw new DOMException('Aborted', 'AbortError')
        }
        return DATA
      },
    })
    await settle()
    const before = writes.length

    model.launchController!.abort()
    // everything the launch would still try to do after the abort
    captured.onProgress('Re-checking BLAST status in... 3')
    captured.onRid('ncbiblast-2')
    captured.act(() => {
      throw new Error('act must not run its callback after an abort')
    })
    released()
    await settle()

    return writes.slice(before)
  }

  test('nothing is written to the model once the abort lands', async () => {
    expect(await abandonMidFlight(true)).toEqual([])
  })

  test('a launch that resolved anyway still applies nothing', async () => {
    expect(await abandonMidFlight(false)).toEqual([])
  })

  test('an abort renders no error, so a cancel does not read as a failure', async () => {
    const { model, writes } = makeModel()

    runLaunch({
      self: model,
      message: 'Submitting query',
      onLaunched: () => {},
      launch: () => Promise.reject(new DOMException('Aborted', 'AbortError')),
    })
    await settle()

    expect(writes.some(w => w.startsWith('setError:Aborted'))).toBe(false)
  })
})

describe('a launch that fails', () => {
  test('records the error and stops the spinner', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { model, writes } = makeModel()

    runLaunch({
      self: model,
      message: 'Resolving orthologs',
      onLaunched: () => {
        throw new Error('a failed launch must not report success')
      },
      launch: () => Promise.reject(new Error('Only 1 ortholog(s) found')),
    })
    await settle()

    expect(writes).toContain('setError:Only 1 ortholog(s) found')
    expect(writes.at(-2)).toBe('setProgress:')
  })
})
