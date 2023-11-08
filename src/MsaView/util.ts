import { Feature } from '@jbrowse/core/util'

// see similar function in protein3d plugin
export function generateMap(f: Feature) {
  let iter = 0

  const strand = f.get('strand')
  const subs = f.children() ?? []
  return strand === -1
    ? subs
        .filter(f => f.get('type') === 'CDS')
        .sort((a, b) => b.get('start') - a.get('start'))
        .map(f => {
          const refName = f.get('refName').replace('chr', '')
          const featureStart = f.get('start')
          const featureEnd = f.get('end')
          const phase = f.get('phase')
          const len = featureEnd - featureStart
          const op = len / 3
          const proteinStart = iter
          const proteinEnd = iter + op
          iter += op
          return {
            refName,
            featureStart,
            featureEnd,
            proteinStart,
            proteinEnd,
            phase,
            strand,
          } as const
        })
    : subs
        .filter(f => f.get('type') === 'CDS')
        .sort((a, b) => a.get('start') - b.get('start'))
        .map(f => {
          const refName = f.get('refName').replace('chr', '')
          const featureStart = f.get('start')
          const featureEnd = f.get('end')
          const phase = f.get('phase')
          const len = featureEnd - featureStart
          const op = len / 3
          const proteinStart = iter
          const proteinEnd = iter + op
          iter += op
          return {
            refName,
            featureStart,
            featureEnd,
            proteinStart,
            proteinEnd,
            phase,
            strand,
          } as const
        })
}

export function checkHovered(hovered: unknown): hovered is {
  hoverFeature: Feature
  hoverPosition: { coord: number; refName: string }
} {
  return (
    !!hovered &&
    typeof hovered == 'object' &&
    'hoverFeature' in hovered &&
    'hoverPosition' in hovered
  )
}
