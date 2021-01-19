/* eslint-disable react/prop-types,react/sort-comp */

import Stockholm from "stockholm-js";
import NewickModule from "newick";
import JukesCantor from "jukes-cantor";
import RapidNeighborJoining from "neighbor-joining";
import { getAncestralReconstruction } from "./reconstruction";
import colorSchemes from "./colorSchemes";
import MSAFactory from "./MSA";

const { Newick } = NewickModule;
const styles = {
  appBar: {
    display: "flex",
    flexDirection: "row",
    fontSize: "large",
    fontStyle: "italic",
  },
  appBarTitle: {
    textAlign: "left",
    paddingTop: "2px",
    paddingLeft: "2px",
  },
  appBarLink: {
    textAlign: "right",
    flexGrow: "1",
    padding: "2px",
  },
};

export default function(pluginManager) {
  const { jbrequire } = pluginManager;
  const React = jbrequire("react");
  const { withStyles } = jbrequire("@material-ui/core/styles");
  const MSA = jbrequire(MSAFactory);

  class App extends React.Component {
    constructor(props) {
      super(props);
      const { config: propConfig = {} } = props;
      const config = {
        ...this.defaultConfig(),
        ...propConfig,
      };
      const {
        genericRowHeight,
        nameFontSize,
        treeWidth,
        branchStrokeStyle,
        nodeHandleRadius,
        nodeHandleClickRadius,
        nodeHandleFillStyle,
        collapsedNodeHandleFillStyle,
        rowConnectorDash,
      } = config;

      // tree configuration
      const treeStrokeWidth = 1;
      const nodeHandleStrokeStyle = branchStrokeStyle;
      const availableTreeWidth =
        treeWidth - nodeHandleRadius - 2 * treeStrokeWidth;
      const computedTreeConfig = {
        treeWidth,
        availableTreeWidth,
        genericRowHeight,
        branchStrokeStyle,
        nodeHandleStrokeStyle,
        nodeHandleRadius,
        nodeHandleClickRadius,
        nodeHandleFillStyle,
        collapsedNodeHandleFillStyle,
        rowConnectorDash,
        treeStrokeWidth,
      };

      // font configuration
      const charFontName = "Menlo,monospace";
      const nameFontName = "inherit";
      const nameFontColor = "black";
      const charFont = `${genericRowHeight}px ${charFontName}`;
      const color = config.color || colorSchemes[config.colorScheme];
      const computedFontConfig = {
        charFont,
        charFontName,
        color,
        nameFontName,
        nameFontSize,
        nameFontColor,
        genericRowHeight,
      };

      // state (we will select a dataset in componentDidMount())
      this.state = {
        config,
        computedTreeConfig,
        computedFontConfig,
      };

      this.inputRef = React.createRef();
      this.msaRef = React.createRef();
    }

    /* PFAM format for embedding PDB IDs in Stockholm files */
    get pdbRegex() {
      return /PDB; +(\S+) +(\S); ([0-9]+)-([0-9]+)/;
    }

    /* Pfam format for embedding coordinates in names (ugh) */
    get nameEncodedCoordRegex() {
      return /\/([0-9]+)-([0-9]+)$/;
    }

    /* regex for sniffing Stockholm format */
    get sniffStockholmRegex() {
      return /^# STOCKHOLM/;
    }

    /* regex for sniffing FASTA format */
    get sniffFastaRegex() {
      return /^>/;
    }

    // method to get data & build tree if necessary
    // async getData(data, config) {
    //   console.log({ data });
    //   if (data.url) {
    //     await Promise.all(
    //       Object.keys(data.url)
    //         .filter(key => !data[key])
    //         .map(async key => {
    //           const url = this.makeURL(data.url[key]);
    //           const res = await fetch(url);
    //           if (res.ok) {
    //             data[key] = await res.text();
    //           } else {
    //             throw new Error(`HTTP ${res.status} ${res.statusText} ${url}`);
    //           }
    //         }),
    //     );
    //   }
    //   if (data.json) {
    //     Object.assign(
    //       data,
    //       typeof data.json === "string" ? JSON.parse(data.json) : data.json,
    //     );
    //   }
    //   if (data.auto) {
    //     if (this.sniffStockholmRegex.test(data.auto)) {
    //       data.stockholm = data.auto;
    //     } else if (this.sniffFastaRegex.test(data.auto)) {
    //       data.fasta = data.auto;
    //     } else {
    //       try {
    //         Object.assign(data, JSON.parse(data.auto));
    //       } catch (e) {
    //         // do nothing if JSON didn't parse
    //       }
    //     }
    //   }
    //   if (!(data.branches && data.rowData)) {
    //     if (data.stockholm) {
    //       // was a Stockholm-format alignment specified?
    //       this.unpackStockholm(data, config, data.stockholm);
    //     } else if (data.stockholmjs) {
    //       // was a StockholmJS object specified?
    //       this.unpackStockholmJS(data, config, data.stockholmjs);
    //     } else if (data.fasta) {
    //       // was a FASTA-format alignment specified?
    //       data.rowData = this.parseFasta(data.fasta);
    //     } else {
    //       throw new Error("no sequence data");
    //     }
    //     // If a Newick-format tree was specified somehow (as a separate data item, or in the Stockholm alignment) then parse it
    //     if (data.newick || data.newickjs) {
    //       const NewickParser = new Newick();
    //       const newickTree = (data.newickjs =
    //         data.newickjs || NewickParser.parse(data.newick));
    //       let nodes = 0;
    //       const getName = obj => (obj.name = obj.name || `node${++nodes}`);
    //       data.branches = [];
    //       const traverse = parent => {
    //         // auto-name internal nodes
    //         if (parent.branchset) {
    //           parent.branchset.forEach(child => {
    //             data.branches.push([
    //               getName(parent),
    //               getName(child),
    //               Math.max(child.length, 0),
    //             ]);
    //             traverse(child);
    //           });
    //         }
    //       };
    //       traverse(newickTree);
    //       data.root = getName(newickTree);
    //     } else {
    //       // no Newick tree was specified, so build a quick-and-dirty distance matrix with Jukes-Cantor, and get a tree by neighbor-joining
    //       const taxa = Object.keys(data.rowData).sort();
    //       const seqs = taxa.map(taxon => data.rowData[taxon]);
    //       console.warn(`Estimating phylogenetic tree (${taxa.length} taxa)...`);
    //       const distMatrix = JukesCantor.calcFiniteDistanceMatrix(seqs);
    //       const rnj = new RapidNeighborJoining.RapidNeighborJoining(
    //         distMatrix,
    //         taxa.map(name => ({ name })),
    //       );
    //       rnj.run();
    //       const tree = rnj.getAsObject();
    //       let nodes = 0;
    //       const getName = obj => {
    //         obj.taxon = obj.taxon || { name: `node${++nodes}` };
    //         return obj.taxon.name;
    //       };
    //       data.branches = [];
    //       const traverse = parent => {
    //         // auto-name internal nodes
    //         parent.children.forEach(child => {
    //           data.branches.push([
    //             getName(parent),
    //             getName(child),
    //             Math.max(child.length, 0),
    //           ]);
    //           traverse(child);
    //         });
    //       };
    //       traverse(tree);
    //       data.root = getName(tree);
    //     }
    //   }
    //   this.guessSeqCoords(data); // this is an idempotent method; if data came from a Stockholm file, it's already been called (in order to filter out irrelevant structures)
    //   return data;
    // }

    // Attempt to figure out start coords relative to database sequences by parsing the sequence names
    // This allows us to align to partial structures
    // This is pretty hacky; the user can alternatively pass these in through the data.seqCoords field
    guessSeqCoords(data) {
      if (!data.seqCoords) {
        data.seqCoords = {};
      }
      Object.keys(data.rowData).forEach(name => {
        const seq = data.rowData[name];
        const len = this.countNonGapChars(seq);
        if (!data.seqCoords[name]) {
          const coordMatch = this.nameEncodedCoordRegex.exec(name);
          if (coordMatch) {
            const startPos = parseInt(coordMatch[1]);
            const endPos = parseInt(coordMatch[2]);
            if (endPos + 1 - startPos === len) {
              data.seqCoords[name] = { startPos, endPos };
            }
          }
        }
        if (!data.seqCoords[name]) {
          data.seqCoords[name] = { startPos: 1, endPos: len };
        } // if we can't guess the start coord, just assume it's the full-length sequence
      });
    }

    makeURL(url) {
      return url.replace("%PUBLIC_URL%", process.env.PUBLIC_URL);
    }

    unpackStockholm(data, config, stockholm) {
      const stockjs = Stockholm.parse(stockholm);
      this.unpackStockholmJS(data, config, stockjs);
    }

    unpackStockholmJS(data, config, stock) {
      const structure = (data.structure = data.structure || {});
      data.rowData = stock.seqdata;
      this.guessSeqCoords(data);
      if (stock.gf.NH && !data.newick) {
        // did the Stockholm alignment include a tree?
        data.newick = stock.gf.NH.join("");
      }
      if (stock.gs.DR && !config.structure.noRemoteStructures) {
        // did the Stockholm alignment include links to PDB?
        Object.keys(stock.gs.DR).forEach(node => {
          const seqCoords = data.seqCoords[node];
          const seqLen = seqCoords.endPos - seqCoords.startPos;
          stock.gs.DR[node].forEach(dr => {
            const match = this.pdbRegex.exec(dr);
            if (match) {
              const pdb = match[1].toLowerCase();
              const chain = match[2];
              const startPos = parseInt(match[3]);
              const endPos = parseInt(match[4]);
              const pdbLen = endPos - startPos;
              const fullLengthMatch = seqLen === pdbLen;
              const sequenceOverlapsStructure =
                seqCoords.startPos <= endPos && seqCoords.endPos >= startPos;
              if (
                sequenceOverlapsStructure &&
                (fullLengthMatch || !config.noPartialStructures)
              ) {
                // check structure matches sequence
                structure[node] = structure[node] || [];
                const pdbIndex = structure[node].findIndex(s => s.pdb === pdb);
                let pdbStruct;
                if (pdbIndex < 0) {
                  pdbStruct = { pdb, chains: [] };
                  structure[node].push(pdbStruct);
                } else {
                  pdbStruct = structure[node][pdbIndex];
                }
                pdbStruct.chains.push({ chain, startPos, endPos });
              } else {
                console.warn(
                  `ignoring structure ${pdb} (${startPos}...${endPos}) since it ${
                    fullLengthMatch
                      ? `does not overlap with ${node}`
                      : `is not a full-length match to ${node} (${pdbLen}!=${seqLen})`
                  }`,
                );
              }
            }
          });
        });
      }
    }

    // componentDidUpdate() {
    //   this.reconstructMissingNodes();
    // }

    get nAlignQueryParam() {
      return "alignnum";
    }

    get alignIdQueryParam() {
      return "alignid";
    }

    // check if any nodes are missing; if so, do ancestral sequence reconstruction
    // reconstructMissingNodes() {
    //   const { data } = this.props.model;
    //   let promise;
    //   if (data) {
    //     const { branches } = data;
    //     const rowData = { ...data.rowData };
    //     const missingAncestors = data.branches.filter(
    //       b => typeof rowData[b[0]] === "undefined",
    //     ).length;
    //     if (missingAncestors && !this.state.reconstructingAncestors) {
    //       this.setState({ reconstructingAncestors: true });

    //       promise = getAncestralReconstruction({ branches, rowData }).then(
    //         result => {
    //           this.incorporateAncestralReconstruction(result.ancestralRowData);
    //         },
    //       );
    //     }
    //   } else {
    //     promise = Promise.resolve();
    //   }
    //   return promise;
    // }

    fn2workerURL(fn) {
      const blob = new Blob([`(${fn.toString()})()`], {
        type: "application/javascript",
      });
      return URL.createObjectURL(blob);
    }

    // incorporateAncestralReconstruction(ancestralRowData) {
    //   const { data } = this.props.model;
    //   const rowData = { ...data.rowData, ...ancestralRowData };
    //   Object.assign(data, { rowData });
    //   this.setDataset(data); // rebuilds indices
    // }

    defaultColorScheme() {
      return "maeditor";
    }

    defaultConfig() {
      return {
        treeAlignHeight: 400,
        genericRowHeight: 24,
        nameFontSize: 12,
        containerHeight: "100%",
        containerWidth: "100%",
        treeWidth: 200,
        nameDivWidth: 200,
        branchStrokeStyle: "black",
        nodeHandleRadius: 4,
        nodeHandleClickRadius: 40,
        nodeHandleFillStyle: "white",
        collapsedNodeHandleFillStyle: "black",
        rowConnectorDash: [2, 2],
        structure: { width: 400, height: 400 },
        handler: {},
        colorScheme: this.defaultColorScheme(),
      };
    }

    // method to parse FASTA (simple enough to build in here)
    parseFasta(fasta) {
      const seq = {};
      let name;
      const re = /^>(\S+)/;
      fasta.split("\n").forEach(line => {
        const match = re.exec(line);
        if (match) {
          seq[(name = match[1])] = "";
        } else if (name) {
          seq[name] = seq[name] + line.replace(/[ \t]/g, "");
        }
      });
      return seq;
    }

    // helpers to recognize gap characters
    isGapChar(c) {
      return typeof c === "string"
        ? c === "-" || c === "."
        : !c || Object.keys(c).length === 0;
    }

    countNonGapChars(seq) {
      return this.rowAsArray(seq).filter(c => !this.isGapChar(c)).length;
    }

    rowAsArray(row) {
      return typeof row === "string" ? row.split("") : row;
    }

    render() {
      const { model } = this.props;
      const { data } = model;
      return (
        <MSA
          ref={this.msaRef}
          data={data}
          isGapChar={this.isGapChar.bind(this)}
          config={this.state.config}
          view={this.state.view}
          treeIndex={this.state.treeIndex}
          alignIndex={this.state.alignIndex}
          computedTreeConfig={this.state.computedTreeConfig}
          computedFontConfig={this.state.computedFontConfig}
          model={model}
        />
      );
    }
  }

  return withStyles(styles)(App);
}
