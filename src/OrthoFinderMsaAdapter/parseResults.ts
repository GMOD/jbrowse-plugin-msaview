import { isLocalPathLocation, isUriLocation } from '@jbrowse/core/util/types'

import type { FileLocation } from '@jbrowse/core/util/types'

const versionSuffix = /\.\d+$/

export interface ProteinEntry {
  orthogroup: string
  /** the id as OrthoFinder wrote it, which names the protein's alignment row */
  id: string
}

/**
 * OrthoFinder's `Orthogroups/Orthogroups.tsv`, one map per species column from
 * protein id to its orthogroup. Per species because OrthoFinder leaves a name
 * two species share unprefixed there: human's `ADAM32` and chicken's are
 * different genes in different orthogroups. Each id is also listed without a
 * trailing `.N` version, since a proteome FASTA usually versions its ids where
 * the matching GFF does not (Ensembl's `ENSP00000269305.4` against
 * `protein_id=ENSP00000269305`).
 */
export function parseOrthogroups(tsv: string) {
  const [header = '', ...rows] = tsv.split(/\r?\n/)
  const species = header.split('\t').slice(1)
  const bySpecies = new Map(
    species.map(name => [name, new Map<string, ProteinEntry>()]),
  )
  for (const row of rows) {
    const [orthogroup, ...cells] = row.split('\t')
    if (orthogroup) {
      cells.forEach((cell, i) => {
        const proteins = bySpecies.get(species[i] ?? '')
        for (const geneId of cell.split(',')) {
          const id = geneId.trim()
          if (proteins && id) {
            const entry = { orthogroup, id }
            proteins.set(id, entry)
            const unversioned = id.replace(versionSuffix, '')
            if (!proteins.has(unversioned)) {
              proteins.set(unversioned, entry)
            }
          }
        }
      })
    }
  }
  return bySpecies
}

/**
 * The alignment and tree name each protein `<species>_<id>`, the species with
 * `.` and space made `_` (OrthoFinder's species_prefixes).
 */
export function alignmentRowName(species: string, id: string) {
  return `${species.replace(/[. ]/g, '_')}_${id}`
}

/** a file the results folder does not hold, as opposed to one it failed to serve */
export function isMissingFile(e: unknown) {
  return e instanceof Error && /HTTP 40[34]\b|ENOENT/.test(e.message)
}

/**
 * OrthoFinder 3 writes every gene tree into one
 * `Resolved_Gene_Trees/Resolved_Gene_Trees.txt`, a line per orthogroup of the
 * form `OG0000055: (newick);`
 */
export function parseResolvedGeneTrees(text: string) {
  const trees = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(': ')
    if (separator > 0) {
      trees.set(line.slice(0, separator), line.slice(separator + 2).trim())
    }
  }
  return trees
}

/** a file inside the results folder, addressed the same way the folder is */
export function resultsFile(results: FileLocation, path: string): FileLocation {
  if (isLocalPathLocation(results)) {
    return {
      ...results,
      localPath: `${results.localPath.replace(/\/+$/, '')}/${path}`,
    }
  } else if (isUriLocation(results)) {
    const folder = new URL(results.uri, results.baseUri).href
    return {
      ...results,
      uri: new URL(path, folder.endsWith('/') ? folder : `${folder}/`).href,
    }
  } else {
    throw new Error(
      'An OrthoFinder results folder must be given as a URL or a local path',
    )
  }
}
