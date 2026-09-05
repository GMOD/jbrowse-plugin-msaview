import { cleanProteinSequence } from '../LaunchMsaView/util'
import { saveBlastResult } from '../utils/blastCache'
import { searchBackends } from '../utils/homologSearch'
import { launchMSA } from '../utils/msa'
import { buildSearchMsa } from '../utils/msaRows'
import { fetchTaxonomyInfo } from '../utils/taxonomyNames'
import { resolveUniProtEntry } from '../utils/unirefHomologs'

import type { JBrowsePluginMsaViewModel } from './model'
import type { LaunchScope } from './runLaunch'

/**
 * The query sequence, and what its row is called. The dialog hands over the
 * translated transcript and the row stays `QUERY`; a spec naming a UniProt
 * accession has the sequence fetched and the row named after the entry
 * (`P53_HUMAN_query`), since a search of swissprot returns the entry itself
 * as a hit and two rows called the same thing collapse into one.
 */
async function resolveQuery(
  self: JBrowsePluginMsaViewModel,
  scope: LaunchScope,
) {
  const params = self.blastParams!
  if (params.proteinSequence) {
    return {
      sequence: cleanProteinSequence(params.proteinSequence),
      name: self.querySeqName,
    }
  }
  if (params.accession) {
    scope.onProgress(`Fetching ${params.accession} from UniProt...`)
    const entry = await resolveUniProtEntry([params.accession], 0, scope.signal)
    if (!entry) {
      throw new Error(`UniProt has no entry ${params.accession}`)
    }
    const name = `${entry.id}_query`
    scope.act(() => {
      self.setQuerySeqName(name)
    })
    return { sequence: entry.sequence, name }
  }
  throw new Error(
    'No query: a search needs a proteinSequence, a UniProt accession, or a connectedTranscript to translate',
  )
}

/**
 * A similarity search, then an alignment of what it found. The program is a
 * backend behind one interface (utils/homologSearch.ts); what differs between
 * them is settled by whether the result came back aligned. A program that
 * aligns as it searches (phmmer) hands over the alignment and the tree is
 * built from it in the browser; one that does not (blastp) hands over bare
 * hits and the chosen aligner runs on them.
 */
export async function doLaunchBlast({
  self,
  scope,
}: {
  self: JBrowsePluginMsaViewModel
  scope: LaunchScope
}) {
  const params = self.blastParams!
  const { selectedTranscript, maxHits, searchProgram = 'blastp' } = params
  const { sequence: query, name: querySeqName } = await resolveQuery(
    self,
    scope,
  )
  const { onProgress, onRid, signal } = scope

  const { hits, queryRow, rid } = await searchBackends[searchProgram]({
    query,
    database: params.blastDatabase,
    maxHits,
    onProgress,
    onRid,
    signal,
  })
  if (hits.length === 0) {
    throw new Error('No hits found')
  }

  onProgress('Fetching species taxonomy info...')
  const taxonomyInfo = await fetchTaxonomyInfo(
    hits.map(h => h.taxid).filter((t): t is number => t !== undefined),
  )
  const { msa: fasta, treeMetadata } = buildSearchMsa({
    hits,
    query,
    queryRow,
    taxonomyInfo,
    querySeqName,
  })
  const { msa, tree } = queryRow
    ? { msa: fasta, tree: '' }
    : await launchMSA({
        algorithm: params.msaAlgorithm ?? 'browser',
        sequence: fasta,
        onProgress,
        signal,
      })

  const treeMetadataJson = JSON.stringify(treeMetadata)
  await saveBlastResult({
    proteinSequence: query,
    blastDatabase: params.blastDatabase,
    msaAlgorithm: params.msaAlgorithm,
    searchProgram: params.searchProgram,
    msa,
    tree,
    treeMetadata: treeMetadataJson,
    rid: rid ?? '',
    geneId: selectedTranscript?.get('parentId'),
    transcriptId: selectedTranscript?.id(),
    transcriptName:
      selectedTranscript?.get('name') ?? selectedTranscript?.get('id'),
    geneName:
      selectedTranscript?.get('gene_name') ??
      selectedTranscript?.get('parentId'),
  })

  return { msa, tree, treeMetadata: treeMetadataJson }
}
