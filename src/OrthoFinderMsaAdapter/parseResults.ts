import { isLocalPathLocation, isUriLocation } from '@jbrowse/core/util/types'

import type { FileLocation } from '@jbrowse/core/util/types'

const versionSuffix = /\.\d+$/

/**
 * Maps every protein id in OrthoFinder's `Orthogroups/Orthogroups.tsv` to its
 * orthogroup. Each id is also listed without a trailing `.N` version, since a
 * proteome FASTA usually versions its ids where the matching GFF does not
 * (Ensembl's `ENSP00000269305.4` against `protein_id=ENSP00000269305`).
 */
export function parseOrthogroups(tsv: string) {
  const orthogroupOf = new Map<string, string>()
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const [orthogroup, ...speciesCells] = line.split('\t')
    if (orthogroup) {
      for (const cell of speciesCells) {
        for (const geneId of cell.split(',')) {
          const id = geneId.trim()
          if (id) {
            orthogroupOf.set(id, orthogroup)
            const unversioned = id.replace(versionSuffix, '')
            if (!orthogroupOf.has(unversioned)) {
              orthogroupOf.set(unversioned, orthogroup)
            }
          }
        }
      }
    }
  }
  return orthogroupOf
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
