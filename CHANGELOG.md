# v1.0.18

- Fix clicking on node labels

# v1.0.17

- Avoid Link redirection at react-msaview importform

# v1.0.16

- Update to latest react-msaview

# v1.0.15

- Change to add to 'Add' top level menu

# v1.0.14

- Fix session link loading from distconfig.json

# v1.0.13

- Factor out code into the react-msaview package on NPM, and make the plugin
  more of a wrapper around this module

# v1.0.12

- Avoid scrolling too far right

# v1.0.11

- Add version number from package.json to about panel

# v1.0.10

- Fix scrolling for large MSA that loads after tree

# v1.0.9

- Fix for MSA loading bar when tree only is displayed

# v1.0.8

- Fix for side scrolling half rendered letters in MSA
- drawNodeBubbles option

# v1.0.7

- Move npm run build script to prepare script in package.jsom

# v1.0.6

- Use postversion to run build so that the accurate version is encoded into the
  release binary

# v1.0.5

- Add prebuild clean

# v1.0.4

- Fix running build before release

# v1.0.3

- Re-release

# v1.0.2

- Ensure clean build with prebuild rm -rf dist

# v1.0.1

- Fix for making demo config on unpkg

# v1.0.0

## Features

- Vertical virtualized scrolling of phylogenetic tree
- Vertical and horizontal virtualized scrolling of multiple sequence alignment
  as a newick tree embedded in stockholm metadata
- View metadata about alignment from MSA headers (e.g. stockholm)
- Collapse subtrees with click action on branches
- The collapse subtree action hides gaps that were introduced by that subtree in
  the rest of the alignment
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
