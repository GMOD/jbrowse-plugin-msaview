import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

import {
  alignmentRowName,
  isMissingFile,
  parseOrthogroups,
  parseResolvedGeneTrees,
  resultsFile,
} from './parseResults'

import type { ProteinEntry } from './parseResults'

/**
 * Reads the `Results_*` folder of an OrthoFinder run as a dataset: each protein
 * id it saw names its orthogroup's alignment and gene tree.
 */
export default class OrthoFinderMsaAdapter extends BaseAdapter {
  orthogroupsP: Promise<Map<string, Map<string, ProteinEntry>>> | undefined

  // OrthoFinder 3 writes every tree into Resolved_Gene_Trees.txt, OrthoFinder 2
  // a Resolved_Gene_Trees/<orthogroup>_tree.txt each; the combined file being
  // absent is what says which, and it is asked once
  resolvedTreesP: Promise<Map<string, string> | 'per-orthogroup'> | undefined

  readResultsFile(path: string) {
    return openLocation(
      resultsFile(this.getConf('resultsLocation'), path),
      this.pluginManager,
    ).readFile('utf8')
  }

  getOrthogroups() {
    this.orthogroupsP ??= this.readResultsFile('Orthogroups/Orthogroups.tsv')
      .then(parseOrthogroups)
      .catch((e: unknown) => {
        this.orthogroupsP = undefined
        throw e
      })
    return this.orthogroupsP
  }

  getResolvedTrees() {
    this.resolvedTreesP ??= this.readResultsFile(
      'Resolved_Gene_Trees/Resolved_Gene_Trees.txt',
    ).then(parseResolvedGeneTrees, (e: unknown) => {
      if (isMissingFile(e)) {
        return 'per-orthogroup' as const
      } else {
        this.resolvedTreesP = undefined
        throw e
      }
    })
    return this.resolvedTreesP
  }

  async readAlignment(orthogroup: string) {
    try {
      return await this.readResultsFile(
        `MultipleSequenceAlignments/${orthogroup}.fa`,
      )
    } catch (e) {
      throw isMissingFile(e)
        ? new Error(
            `OrthoFinder wrote no alignment for ${orthogroup}. It skips a few small orthogroups, and writes none at all when run with -og, or as OrthoFinder 2 without -M msa`,
            { cause: e },
          )
        : e
    }
  }

  // only orthogroups of four or more genes have a tree
  async readTree(orthogroup: string) {
    const resolvedTrees = await this.getResolvedTrees()
    return resolvedTrees === 'per-orthogroup'
      ? this.readResultsFile(
          `Resolved_Gene_Trees/${orthogroup}_tree.txt`,
        ).catch((e: unknown) => {
          if (isMissingFile(e)) {
            return undefined
          } else {
            throw e
          }
        })
      : resolvedTrees.get(orthogroup)
  }

  // the column named after the assembly when there is one, else every column,
  // for a run whose proteome files are named some other way
  async speciesFor(assemblyName?: string) {
    const bySpecies = await this.getOrthogroups()
    return assemblyName && bySpecies.has(assemblyName)
      ? [assemblyName]
      : [...bySpecies.keys()]
  }

  async getMSAList(assemblyName?: string) {
    const bySpecies = await this.getOrthogroups()
    const species = await this.speciesFor(assemblyName)
    return [
      ...new Set(species.flatMap(s => [...(bySpecies.get(s)?.keys() ?? [])])),
    ]
  }

  async getMSA(proteinId: string, assemblyName?: string) {
    const bySpecies = await this.getOrthogroups()
    const found = (await this.speciesFor(assemblyName))
      .map(species => ({
        species,
        entry: bySpecies.get(species)?.get(proteinId),
      }))
      .find(({ entry }) => entry)
    if (found?.entry) {
      const { species, entry } = found
      const [msa, tree] = await Promise.all([
        this.readAlignment(entry.orthogroup),
        this.readTree(entry.orthogroup),
      ])
      return { msa, tree, queryRowName: alignmentRowName(species, entry.id) }
    } else {
      throw new Error(`${proteinId} is in no OrthoFinder orthogroup`)
    }
  }
}
