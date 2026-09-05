import { isAbortError } from '../utils/fetch'

import type { JBrowsePluginMsaViewModel } from './model'

/**
 * What a launch is allowed to do to the model and to the network while it runs.
 *
 * Every write a launch makes goes through `act`, so "nothing touches the model
 * once the launch has been abandoned" is one rule in one place. Spreading that
 * guard across the call sites only takes one omission to undo: an abandoned
 * launch keeps running until its next network hop rejects, and an action on a
 * destroyed mobx-state-tree node throws where nothing is catching.
 */
export interface LaunchScope {
  /** aborts when the user cancels, and when the view is destroyed */
  signal: AbortSignal
  act: (fn: () => void) => void
  onProgress: (arg: string) => void
  /** the EBI job id, published before the first poll so the view can link out */
  onRid: (arg: string) => void
}

interface LaunchedData {
  msa: string
  /** empty when the aligner built no tree, and one is then built in the browser */
  tree: string
  treeMetadata: string
}

/**
 * Run one launch attempt, owning the AbortController that ties it to the view.
 *
 * The controller lives on the model because two things end a launch and neither
 * is here: the Cancel button, and the disposer `afterCreate` registers. Before
 * it existed, closing a view mid-BLAST left the poller checking EBI for the
 * job's lifetime and then writing to a node that was gone.
 */
export function runLaunch({
  self,
  message,
  launch,
  onLaunched,
}: {
  self: JBrowsePluginMsaViewModel
  message: string
  launch: (scope: LaunchScope) => Promise<LaunchedData>
  onLaunched: () => void
}) {
  const controller = new AbortController()
  const { signal } = controller
  self.setLaunchController(controller)

  const act = (fn: () => void) => {
    if (!signal.aborted) {
      fn()
    }
  }
  const scope: LaunchScope = {
    signal,
    act,
    onProgress: arg => {
      act(() => {
        self.setProgress(arg)
      })
    },
    onRid: arg => {
      act(() => {
        self.setRid(arg)
      })
    },
  }

  void (async () => {
    try {
      act(() => {
        self.setProgress(message)
        self.setError(undefined)
      })
      const data = await launch(scope)
      act(() => {
        self.setData(data)
        // the in-browser aligner and a search hands back rows and no tree;
        // react-msaview's neighbour joining over the finished alignment is
        // what EBI's simple_phylogeny would have computed, without the job
        if (!data.tree && self.rows.length >= 2) {
          self.calculateNeighborJoiningTreeFromMSA()
        }
        onLaunched()
      })
    } catch (e) {
      // a cancel is not a failure: drawing the error panel for one would tell
      // the user their launch broke when they are the one who stopped it
      if (!isAbortError(e)) {
        act(() => {
          self.setError(e)
        })
        console.error(e)
      }
    } finally {
      act(() => {
        self.setProgress('')
        // only if a later launch has not already claimed the slot
        if (self.launchController === controller) {
          self.setLaunchController(undefined)
        }
      })
    }
  })()
}
