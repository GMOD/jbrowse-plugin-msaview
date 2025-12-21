# jbrowse-plugin-msaview

This plugin packages https://github.com/gmod/react-msaview for usage inside of
JBrowse 2

See the docs for the react-msaview for more info
https://github.com/GMOD/react-msaview/blob/main/docs/user_guide.md

## Gallery

![](img/1.png)

MSAView plugin running in JBrowse 2

## Demo

https://jbrowse.org/code/jb2/main/index.html?config=https://unpkg.com/jbrowse-plugin-msaview/dist/config.json&session=share-BVmmEYAoAv&password=SuQaN

## Features

- Vertical virtualized scrolling of phylogenetic tree
- Vertical and horizontal virtualized scrolling of multiple sequence alignment
- View metadata about alignment from MSA headers (e.g. stockholm)
- Collapse subtrees with click action on branches which also hides gaps that
  were introduced by that subtree in the rest of the alignment
- Allows "zooming out" by setting tiny rowHeight/colWidth settings
- Allows changing color schemes, with jalview, clustal, and other color schemes
- Allows toggling the branch length rendering for the phylogenetic tree
- Can share sessions with other users which will send relevant settings and
  links to files to automatically open your results
- The tree or the MSA panel can be loaded separately from each other

## File format supports

- FASTA formatted for MSA (e.g. gaps already inserted)
- Stockholm files (e.g. .stock file, with or without embedded newick tree, uses
  stockholm-js parser. also supports "multi-stockholm" files with multiple
  alignments embedded in a single file)
- Clustal files (e.g. .aln file, uses clustal-js parser)
- Newick (tree can be loaded separately as a .nh file)

## LaunchView-MsaView extension point

This plugin registers a `LaunchView-MsaView` extension point that allows
programmatic launching of an MsaView. This can be used via the JBrowse 2
session spec URL parameters (see
https://jbrowse.org/jb2/docs/urlparams/#session-spec).

### Parameters

| Parameter          | Required                      | Description                              |
| ------------------ | ----------------------------- | ---------------------------------------- |
| `data`             | One of data/msaFileLocation   | `{ msa: string, tree?: string }`         |
| `msaFileLocation`  | One of data/msaFileLocation   | `{ uri: string }` for MSA file           |
| `treeFileLocation` | No                            | `{ uri: string }` for tree file          |
| `connectedViewId`  | No                            | ID of connected LinearGenomeView         |
| `connectedFeature` | No                            | Feature for cross-linking                |
| `displayName`      | No                            | Custom view display name                 |
| `colorSchemeName`  | No                            | Color scheme (e.g., 'percent_identity_dynamic') |
| `colWidth`         | No                            | Column width in pixels                   |
| `rowHeight`        | No                            | Row height in pixels                     |
| `treeAreaWidth`    | No                            | Tree area width                          |
| `treeWidth`        | No                            | Tree width                               |
| `drawNodeBubbles`  | No                            | Show node bubbles on tree                |
| `labelsAlignRight` | No                            | Align labels to the right                |
| `showBranchLen`    | No                            | Show branch lengths                      |
| `querySeqName`     | No                            | Name for query sequence                  |

### URL example

```
https://jbrowse.org/code/jb2/main/?config=config.json&session=spec-{"views":[{"type":"MsaView","msaFileLocation":{"uri":"https://example.com/alignment.fa"}}]}
```

### Programmatic usage

```typescript
pluginManager.evaluateExtensionPoint('LaunchView-MsaView', {
  session,
  data: { msa: clustalOutput, tree: newickTree },
  displayName: 'My MSA',
  colorSchemeName: 'percent_identity_dynamic',
})
```
