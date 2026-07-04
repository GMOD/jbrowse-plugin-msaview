export function hasHoverPosition(
  hovered: unknown,
): hovered is { hoverPosition: { coord: number; refName: string } } {
  return (
    !!hovered &&
    typeof hovered === 'object' &&
    'hoverPosition' in hovered &&
    !!hovered.hoverPosition
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
