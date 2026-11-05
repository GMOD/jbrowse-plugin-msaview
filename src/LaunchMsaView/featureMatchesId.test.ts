import { SimpleFeature } from '@jbrowse/core/util'
import { expect, test } from 'vitest'

import { featureMatchesId, findDatasetId } from './util'

const transcript = new SimpleFeature({
  uniqueId: 'u1',
  refName: 'chr17',
  start: 0,
  end: 10,
  id: 'ENST00000269305.9',
  transcript_id: 'ENST00000269305.9',
  gene_name: 'TP53',
})

test('a transcript matches a dataset keyed by transcript id', () => {
  expect(featureMatchesId(transcript, 'ENST00000269305.9')).toBe(true)
})

test('a transcript matches a dataset keyed by its gene symbol', () => {
  expect(featureMatchesId(transcript, 'TP53')).toBe(true)
  expect(featureMatchesId(transcript, 'TP63')).toBe(false)
})

// the shape of NCBI's GFF3, as the OrthoFinder synteny tutorial's flies have it
const ncbiTranscript = new SimpleFeature({
  uniqueId: 'u2',
  refName: '2L',
  start: 9839,
  end: 18570,
  id: 'rna-NM_078715.4',
  name: 'NM_078715.4',
  subfeatures: [
    {
      uniqueId: 'u3',
      refName: '2L',
      start: 9900,
      end: 10000,
      type: 'CDS',
      protein_id: 'NP_523439.2',
    },
  ],
})
const ncbiGene = new SimpleFeature({
  uniqueId: 'u4',
  refName: '2L',
  start: 9839,
  end: 21376,
  id: 'gene-Dmel_CG2671',
  name: 'l(2)gl',
})

test("a transcript matches a proteome keyed by its CDS's protein_id", () => {
  expect(featureMatchesId(ncbiTranscript, 'NP_523439.2')).toBe(true)
})

test('a set keyed by gene id matches through the gene, without its gene- prefix', () => {
  expect(
    findDatasetId(ncbiTranscript, ncbiGene, new Set(['Dmel_CG2671'])),
  ).toBe('Dmel_CG2671')
  const ensemblGene = new SimpleFeature({
    uniqueId: 'u5',
    refName: '17',
    start: 0,
    end: 10,
    id: 'gene:ENSG00000141510',
  })
  expect(
    findDatasetId(transcript, ensemblGene, new Set(['ENSG00000141510'])),
  ).toBe('ENSG00000141510')
})

test("the transcript's own entry wins over its gene's", () => {
  expect(
    findDatasetId(
      ncbiTranscript,
      ncbiGene,
      new Set(['Dmel_CG2671', 'NM_078715.4']),
    ),
  ).toBe('NM_078715.4')
  expect(findDatasetId(ncbiTranscript, ncbiGene, new Set(['other']))).toBe(
    undefined,
  )
})

test('a gene named by symbol matches the name OrthoFinder rewrote', () => {
  const gene = new SimpleFeature({
    uniqueId: 'u6',
    refName: '3R',
    start: 0,
    end: 10,
    id: 'gene-E(spl)m2-BFM',
  })
  expect(findDatasetId(ncbiTranscript, gene, new Set(['E_spl_m2-BFM']))).toBe(
    'E_spl_m2-BFM',
  )
})
