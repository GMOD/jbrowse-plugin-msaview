import React from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'

import { makeStyles } from 'tss-react/mui'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// locals
import { MsaViewModel } from '../MsaView/model'
import { Assembly } from '@jbrowse/core/assemblyManager/assembly'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    background: 'rgba(255,255,0,0.2)',
    border: '1px solid rgba(50,50,0,0.2)',
    position: 'absolute',
    zIndex: 1000,
    textAlign: 'center',
    pointerEvents: 'none',
    overflow: 'hidden',
  },
})

function getCanonicalName(assembly: Assembly, s: string) {
  return assembly.getCanonicalRefName(s) ?? s
}

const MsaToGenomeHighlight = observer(function ({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const { assemblyManager, views } = getSession(model)
  const p = views.find(f => f.type === 'MsaView') as MsaViewModel
  const assembly = assemblyManager.get(model.assemblyNames[0])
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