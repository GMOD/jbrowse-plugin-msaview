import { getSession } from '@jbrowse/core/util'
import { untracked } from 'mobx'

import { isAbortError } from '../utils/fetch'

import type { JBrowsePluginMsaViewModel } from './model'

/**
 * The in-browser aligner and a search hand back rows and no tree;
 * react-msaview's neighbour joining over the finished alignment is what EBI's
 * simple_phylogeny would have computed, without the job.
 *
 * It runs after the alignment is applied, and its refusals are reported rather
 * than thrown: the library caps neighbour joining by row count and throws above
 * it, and inside the success path that throw discarded an alignment that had
 * just cost fifteen minutes of EBI queue behind "Running EBI BLAST failed".
 * A search asking for 1000 hits clears that cap on its own.
 */
function buildTree(self: JBrowsePluginMsaViewModel) {
  if (self.rows.length < 2) {
    return
  }
  try {
    self.calculateNeighborJoiningTreeFromMSA()
  } catch (e) {
    console.error(e)
    // a notice, not the view's error: the alignment is fine and on screen
    try {
      getSession(self).notify(
        `The alignment loaded, but no tree was built. ${e instanceof Error ? e.message : String(e)}`,
        'warning',
      )
    } catch (e2) {
      console.error(e2)
    }
  }
}

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
 * is here: the Cancel button, and the disposer `afterCreate` registers. A launch
 * already holding it is aborted first, so a re-fired autorun replaces the
 * attempt rather than orphaning one that nothing can cancel.
 *
 * Runs untracked: it is called from the launch autoruns, and whatever the
 * launch body reads before its first await would otherwise become a reason to
 * launch again.
 */
export function runLaunch(args: {
  self: JBrowsePluginMsaViewModel
  message: string
  launch: (scope: LaunchScope) => Promise<LaunchedData>
  onLaunched: () => void
}) {
  untracked(() => {
    startLaunch(args)
  })
}

function startLaunch({
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
  self.launchController?.abort()
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
        onLaunched()
      })
      if (!data.tree) {
        act(() => {
          buildTree(self)
        })
      }
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
