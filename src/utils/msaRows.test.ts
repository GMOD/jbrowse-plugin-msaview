import { expect, test } from 'vitest'

import { buildSearchMsa } from './msaRows'

const hit = (accession: string, sciname: string, taxid: number) => ({
  accession,
  id: accession,
  title: '',
  sciname,
  taxid,
  sequence: 'MK',
})

test('row names carry no character a Newick tree gives meaning to', () => {
  const { msa, treeMetadata } = buildSearchMsa({
    hits: [
      hit('P0A7G6', 'Escherichia coli (strain K12)', 83333),
      hit('F6XYZ1', 'Equus przewalskii', 9798),
      hit('1abc:A (chain A)', 'Homo sapiens', 9606),
    ],
    query: 'MK',
    taxonomyInfo: new Map([
      [
        9798,
        { sciname: 'Equus przewalskii', commonName: "Przewalski's horse" },
      ],
    ]),
  })
  expect(Object.keys(treeMetadata)).toEqual([
    'P0A7G6-Escherichia_coli_strain_K12',
    'F6XYZ1-Przewalski_s_Horse',
    '1abc_A_chain_A_-Homo_sapiens',
  ])
  expect(msa).toContain('>P0A7G6-Escherichia_coli_strain_K12\n')
})
