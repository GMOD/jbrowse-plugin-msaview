// locals
import { JBrowsePluginMsaViewModel } from './model'

export function msaCoordToGenomeCoord({
  model,
  coord: mouseCol,
}: {
  model: JBrowsePluginMsaViewModel
  coord: number
}) {
  const { transcriptToMsaMap } = model
  if (mouseCol === undefined || transcriptToMsaMap === undefined) {
    return
  }

  const c = mouseCol - 1
  const k1 = model.globalCoordToRowSpecificSeqCoord('QUERY', c) || 0
  const k2 = model.globalCoordToRowSpecificSeqCoord('QUERY', c + 1) || 0
  const { refName, p2g } = transcriptToMsaMap
  const s = p2g[k1]
  const e = p2g[k2]
  return s !== undefined && e !== undefined
    ? {
        refName,
        start: Math.min(s, e),
        end: Math.max(s, e),
      }
    : undefined
}
