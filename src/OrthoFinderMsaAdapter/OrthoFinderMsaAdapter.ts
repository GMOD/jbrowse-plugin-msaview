import { BaseAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { openLocation } from '@jbrowse/core/util/io'

import {
  parseOrthogroups,
  parseResolvedGeneTrees,
  resultsFile,
} from './parseResults'

/**
 * Reads the `Results_*` folder of an OrthoFinder run as a dataset: each protein
 * id it saw names its orthogroup's alignment and gene tree.
 */
export default class OrthoFinderMsaAdapter extends BaseAdapter {
  orthogroupsP: Promise<Map<string, string>> | undefined

  resolvedTreesP: Promise<Map<string, string> | undefined> | undefined

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

  // OrthoFinder 2 writes Resolved_Gene_Trees/<orthogroup>_tree.txt instead, so
  // a missing combined file means a version 2 run rather than an error
  getResolvedTrees() {
    this.resolvedTreesP ??= this.readResultsFile(
      'Resolved_Gene_Trees/Resolved_Gene_Trees.txt',
    ).then(parseResolvedGeneTrees, () => {
      this.resolvedTreesP = undefined
      return undefined
    })
    return this.resolvedTreesP
  }

  async readAlignment(orthogroup: string) {
    try {
      return await this.readResultsFile(
        `MultipleSequenceAlignments/${orthogroup}.fa`,
      )
    } catch (e) {
      throw new Error(
        `OrthoFinder has no alignment for ${orthogroup}; it does not align every orthogroup`,
        { cause: e },
      )
    }
  }

  // only orthogroups of four or more genes get a tree
  async readTree(orthogroup: string) {
    const resolvedTrees = await this.getResolvedTrees()
    return resolvedTrees
      ? resolvedTrees.get(orthogroup)
      : this.readResultsFile(
          `Resolved_Gene_Trees/${orthogroup}_tree.txt`,
        ).catch(() => undefined)
  }

  async getMSAList() {
    return [...(await this.getOrthogroups()).keys()]
  }

  async getMSA(proteinId: string) {
    const orthogroup = (await this.getOrthogroups()).get(proteinId)
    if (orthogroup) {
      const [msa, tree] = await Promise.all([
        this.readAlignment(orthogroup),
        this.readTree(orthogroup),
      ])
      return { msa, tree }
    } else {
      throw new Error(`${proteinId} is in no OrthoFinder orthogroup`)
    }
  }
}
