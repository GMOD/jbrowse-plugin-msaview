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

/**
 * Extracts UniProt ID from an AlphaFold URL
 * Examples:
 * - https://alphafold.ebi.ac.uk/files/AF-P12345-F1-model_v6.cif -> P12345
 * - https://alphafold.ebi.ac.uk/files/msa/AF-P12345-F1-msa_v6.a3m -> P12345
 */
export function getUniprotIdFromAlphaFoldUrl(url: string) {
  const match = /AF-([A-Z0-9]+)-F\d+/.exec(url)
  return match?.[1]
}
