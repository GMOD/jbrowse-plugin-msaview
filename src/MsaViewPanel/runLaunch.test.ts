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
    rows: [] as string[][],
    calculateNeighborJoiningTreeFromMSA: () => writes.push('neighborJoining'),
  } as unknown as JBrowsePluginMsaViewModel & {
    launchController: AbortController | undefined
    rows: string[][]
    calculateNeighborJoiningTreeFromMSA: () => void
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

describe('a launch started while another holds the controller', () => {
  test('aborts the first, so nothing is left polling that Cancel cannot reach', async () => {
    const { model } = makeModel()
    const signals: AbortSignal[] = []
    const launch = (scope: LaunchScope) => {
      signals.push(scope.signal)
      return new Promise<typeof DATA>(() => {})
    }

    runLaunch({ self: model, message: 'a', onLaunched: () => {}, launch })
    runLaunch({ self: model, message: 'b', onLaunched: () => {}, launch })
    await settle()

    expect(signals.map(s => s.aborted)).toEqual([true, false])
    model.launchController!.abort()
    expect(signals[1]!.aborted).toBe(true)
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

// react-msaview caps neighbor joining by row count and throws above it, and a
// search can ask for 1000 hits. Thrown from inside the success path, that
// discarded a finished alignment behind "Running EBI BLAST failed".
describe('a launch whose alignment is too big to build a tree from', () => {
  test('keeps the alignment and reports the refusal', async () => {
    const { model, writes } = makeModel()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    model.rows = [
      ['a', 'MK'],
      ['b', 'MK'],
    ]
    model.calculateNeighborJoiningTreeFromMSA = () => {
      throw new Error('Neighbor joining here is capped at 500 sequences')
    }
    const onLaunched = vi.fn()

    runLaunch({
      self: model,
      message: 'Submitting query',
      onLaunched,
      launch: async () => ({ ...DATA, tree: '' }),
    })
    await settle()

    expect(writes).toContain('setData')
    expect(onLaunched).toHaveBeenCalled()
    expect(writes.filter(w => w.startsWith('setError:'))).toEqual([
      'setError:undefined',
    ])
  })

  test('builds the tree when the alignment came back without one', async () => {
    const { model, writes } = makeModel()
    model.rows = [
      ['a', 'MK'],
      ['b', 'MK'],
    ]

    runLaunch({
      self: model,
      message: 'Submitting query',
      onLaunched: vi.fn(),
      launch: async () => ({ ...DATA, tree: '' }),
    })
    await settle()

    expect(writes).toContain('neighborJoining')
  })
})
