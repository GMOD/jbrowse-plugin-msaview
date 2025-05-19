import React from 'react'

import { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import { getSession } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import { useStyles } from './util'
import { JBrowsePluginMsaViewModel } from '../MsaViewPanel/model'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

function getCanonicalName(assembly: Assembly, s: string) {
  return assembly.getCanonicalRefName(s) ?? s
}

const MsaToGenomeHighlight = observer(function MsaToGenomeHighlight2({
  model,
}: {
  model: LGV
}) {
  const { classes } = useStyles()
  const { assemblyManager, views } = getSession(model)
  const p = views.find(f => f.type === 'MsaView') as
    | JBrowsePluginMsaViewModel
    | undefined
  const assembly = assemblyManager.get(model.assemblyNames[0]!)
  return assembly ? (
    <>
      {p?.connectedHighlights.map((r, idx) => {
        const refName = getCanonicalName(assembly, r.refName)
        const s = model.bpToPx({ refName, coord: r.start })
        const e = model.bpToPx({ refName, coord: r.end })
        if (s && e) {
          const width = Math.max(Math.abs(e.offsetPx - s.offsetPx), 4)
          const left = Math.min(s.offsetPx, e.offsetPx) - model.offsetPx
          return (
            <div
              key={`${JSON.stringify(r)}-${idx}`}
              className={classes.highlight}
              style={{ left, width }}
            />
          )
        }
        return null
      })}
    </>
  ) : null
})

export default MsaToGenomeHighlight
