import { Feature } from '@jbrowse/core/util'

export function checkHovered(hovered: unknown): hovered is {
  hoverFeature: Feature
  hoverPosition: { coord: number; refName: string }
} {
  return (
    typeof hovered === 'object' &&
    hovered !== null &&
    'hoverFeature' in hovered &&
    'hoverPosition' in hovered
  )
}
