import { Feature } from '@jbrowse/core/util'

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
