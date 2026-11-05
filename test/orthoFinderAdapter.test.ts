import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import PluginManager from '@jbrowse/core/PluginManager'
import { parseMSA, parseNewick } from 'msa-parsers'
import { expect, test } from 'vitest'

import OrthoFinderMsaAdapter from '../src/OrthoFinderMsaAdapter/OrthoFinderMsaAdapter'
import configSchemaF from '../src/OrthoFinderMsaAdapter/configSchema'

// trimmed from real runs over OrthoFinder's ExampleData: v3 is 3.2's default
// settings, v2 is 2.5.5 with -M msa
function makeAdapter(version: 'v2' | 'v3') {
  const config = configSchemaF().create({
    type: 'OrthoFinderMsaAdapter',
    resultsLocation: {
      localPath: join(
        dirname(fileURLToPath(import.meta.url)),
        'fixtures/orthofinder',
        version,
      ),
      locationType: 'LocalPathLocation',
    },
  })
  return new OrthoFinderMsaAdapter(config, undefined, new PluginManager())
}

interface TreeNode {
  name?: string
  children?: TreeNode[]
}

function leafNames(node: TreeNode): string[] {
  return node.children?.length
    ? node.children.flatMap(leafNames)
    : [node.name ?? '']
}

test('lists every protein id OrthoFinder assigned, across species columns', async () => {
  const ids = await makeAdapter('v3').getMSAList()
  expect(ids).toContain('gi|290752526|emb|CBH40498.1|')
  expect(ids).toContain('gi|31541268|gb|AAP56569.1|')
  expect(ids).toContain('gi|144227731|gb|AAZ44711.2|')
})

test('a v3 orthogroup reads its alignment and its line of Resolved_Gene_Trees.txt', async () => {
  const { msa, tree } = await makeAdapter('v3').getMSA(
    'gi|31541268|gb|AAP56569.1|',
  )
  const rows = parseMSA(msa).getNames()
  expect(rows).toContain('Mycoplasma_gallisepticum_gi|31541268|gb|AAP56569.1|')
  expect(leafNames(parseNewick(tree!)).toSorted()).toEqual(rows.toSorted())
})

test('a v3 orthogroup too small for a tree reads its alignment alone', async () => {
  const { msa, tree } = await makeAdapter('v3').getMSA(
    'gi|144227731|gb|AAZ44711.2|',
  )
  expect(parseMSA(msa).getNames()).toHaveLength(2)
  expect(tree).toBeUndefined()
})

test('an orthogroup OrthoFinder did not align names itself in the error', async () => {
  await expect(
    makeAdapter('v3').getMSA('gi|284812252|gb|AAP57008.2|'),
  ).rejects.toThrow('no alignment for OG0000331')
})

test('a v2 run, with CRLF tables and a file per tree, reads the same way', async () => {
  const adapter = makeAdapter('v2')
  expect(await adapter.getMSAList()).toContain('gi|284811859|gb|AAP56391.2|')
  const { msa, tree } = await adapter.getMSA('gi|284811859|gb|AAP56391.2|')
  const rows = parseMSA(msa).getNames()
  expect(rows).toHaveLength(26)
  expect(leafNames(parseNewick(tree!)).toSorted()).toEqual(rows.toSorted())

  const small = await adapter.getMSA('gi|71852101|gb|AAZ44709.1|')
  expect(small.tree).toBeUndefined()
})
