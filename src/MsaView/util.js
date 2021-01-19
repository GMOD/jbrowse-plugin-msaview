import Stockholm from "stockholm-js";

/* PFAM format for embedding PDB IDs in Stockholm files */
const pdbRegex = /PDB; +(\S+) +(\S); ([0-9]+)-([0-9]+)/;

/* Pfam format for embedding coordinates in names (ugh) */
const nameEncodedCoordRegex = /\/([0-9]+)-([0-9]+)$/;

export function indexData(data) {
  console.log({ data });
  const treeIndex = buildTreeIndex(data);
  const alignIndex = buildAlignmentIndex(data);
  return { data, treeIndex, alignIndex };
}

function getRowAsArray(row) {
  return typeof row === "string" ? row.split("") : row;
}

// helpers to recognize gap characters
export function isGapChar(c) {
  return typeof c === "string"
    ? c === "-" || c === "."
    : !c || Object.keys(c).length === 0;
}

// index alignment
function buildAlignmentIndex(data) {
  const { rowData } = data;
  const rowDataAsArray = {};
  const alignColToSeqPos = {};
  const seqPosToAlignCol = {};
  const isChar = {};
  let columns;
  Object.keys(rowData).forEach(node => {
    const row = rowData[node];
    if (typeof columns !== "undefined" && columns !== row.length) {
      console.error("Inconsistent row lengths");
    }
    columns = row.length;
    const pos2col = [];
    let pos = 0;
    const rowAsArray = getRowAsArray(row);
    alignColToSeqPos[node] = rowAsArray.map((c, col) => {
      if (typeof c === "string") {
        isChar[c] = true;
      }
      const isGap = isGapChar(c);
      if (!isGap) {
        pos2col.push(col);
      }
      return isGap ? pos : pos++;
    });
    rowDataAsArray[node] = rowAsArray;
    seqPosToAlignCol[node] = pos2col;
  });
  const chars = Object.keys(isChar).sort();
  return {
    alignColToSeqPos,
    seqPosToAlignCol,
    rowDataAsArray,
    columns,
    chars,
  };
}
// get the root node(s) of a list of [parent,child,length] branches
function getRoots(branches) {
  const isNode = {};
  const hasParent = {};
  branches.forEach(branch => {
    const [p, c] = branch;
    isNode[p] = isNode[c] = hasParent[c] = true;
  });
  return Object.keys(isNode)
    .filter(n => !hasParent[n])
    .sort();
}
// index tree
function buildTreeIndex(data) {
  const { branches } = data;
  let { root } = data;
  const rootSpecified = typeof root !== "undefined";

  console.log({ data, branches });
  const roots = getRoots(branches);
  if (roots.length === 0 && (branches.length > 0 || !rootSpecified)) {
    throw new Error("No root nodes");
  }
  if (rootSpecified) {
    if (roots.indexOf(root) < 0) {
      throw new Error("Specified root node is not a root");
    }
  } else {
    if (roots.length !== 1) {
      throw new Error("Multiple possible root nodes, and no root specified");
    }
    root = roots[0];
  }
  const children = {};
  const branchLength = {};
  children[root] = [];
  branchLength[root] = 0;
  branches.forEach(branch => {
    const parent = branch[0];
    const child = branch[1];
    const len = branch[2];
    children[parent] = children[parent] || [];
    children[child] = children[child] || [];
    children[parent].push(child);
    branchLength[child] = len;
  });
  const nodes = [];
  const seenNode = {};
  const descendants = {};
  const distFromRoot = {};
  let maxDistFromRoot = 0;
  const addNode = node => {
    if (!node) {
      throw new Error("All nodes must be named");
    }
    if (seenNode[node]) {
      throw new Error(`All node names must be unique (duplicate '${node}')`);
    }
    seenNode[node] = true;
    nodes.push(node);
  };
  const addSubtree = (node, parent) => {
    distFromRoot[node] =
      (typeof parent !== "undefined" ? distFromRoot[parent] : 0) +
      branchLength[node];
    maxDistFromRoot = Math.max(maxDistFromRoot, distFromRoot[node]);
    const kids = children[node];
    let clade = [];
    if (kids.length === 2) {
      clade = clade.concat(addSubtree(kids[0], node));
      addNode(node);
      clade = clade.concat(addSubtree(kids[1], node));
    } else {
      addNode(node);
      kids.forEach(child => (clade = clade.concat(addSubtree(child, node))));
    }
    descendants[node] = clade;
    return [node].concat(clade);
  };
  addSubtree(root);
  return {
    root,
    branches,
    children,
    descendants,
    branchLength,
    nodes,
    distFromRoot,
    maxDistFromRoot,
  };
}

function unpackStockholm(data, config, stockholm) {
  const stockjs = Stockholm.parse(stockholm);
  unpackStockholmJS(data, config, stockjs);
}

function unpackStockholmJS(data, config, stock) {
  const structure = (data.structure = data.structure || {});
  data.rowData = stock.seqdata;
  guessSeqCoords(data);
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
        const match = pdbRegex.exec(dr);
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

// Attempt to figure out start coords relative to database sequences by parsing the sequence names
// This allows us to align to partial structures
// This is pretty hacky; the user can alternatively pass these in through the data.seqCoords field
function guessSeqCoords(data) {
  if (!data.seqCoords) {
    data.seqCoords = {};
  }
  Object.keys(data.rowData).forEach(name => {
    const seq = data.rowData[name];
    const len = countNonGapChars(seq);
    if (!data.seqCoords[name]) {
      const coordMatch = nameEncodedCoordRegex.exec(name);
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

function countNonGapChars(seq) {
  return getRowAsArray(seq).filter(c => !isGapChar(c)).length;
}

async function getData(data, config) {
  console.log({ data });
  // if (data.url) {
  //   await Promise.all(
  //     Object.keys(data.url)
  //       .filter(key => !data[key])
  //       .map(async key => {
  //         const url = this.makeURL(data.url[key]);
  //         const res = await fetch(url);
  //         if (res.ok) {
  //           data[key] = await res.text();
  //         } else {
  //           throw new Error(`HTTP ${res.status} ${res.statusText} ${url}`);
  //         }
  //       }),
  //   );
  // }
  // if (data.json) {
  //   Object.assign(
  //     data,
  //     typeof data.json === "string" ? JSON.parse(data.json) : data.json,
  //   );
  // }
  if (data.auto) {
    if (this.sniffStockholmRegex.test(data.auto)) {
      data.stockholm = data.auto;
    } else if (this.sniffFastaRegex.test(data.auto)) {
      data.fasta = data.auto;
    } else {
      try {
        Object.assign(data, JSON.parse(data.auto));
      } catch (e) {
        // do nothing if JSON didn't parse
      }
    }
  }
  if (!(data.branches && data.rowData)) {
    if (data.stockholm) {
      // was a Stockholm-format alignment specified?
      this.unpackStockholm(data, config, data.stockholm);
    } else if (data.stockholmjs) {
      // was a StockholmJS object specified?
      this.unpackStockholmJS(data, config, data.stockholmjs);
    } else if (data.fasta) {
      // was a FASTA-format alignment specified?
      data.rowData = this.parseFasta(data.fasta);
    } else {
      throw new Error("no sequence data");
    }
    // If a Newick-format tree was specified somehow (as a separate data item, or in the Stockholm alignment) then parse it
    if (data.newick || data.newickjs) {
      const NewickParser = new Newick();
      const newickTree = (data.newickjs =
        data.newickjs || NewickParser.parse(data.newick));
      let nodes = 0;
      const getName = obj => (obj.name = obj.name || `node${++nodes}`);
      data.branches = [];
      const traverse = parent => {
        // auto-name internal nodes
        if (parent.branchset) {
          parent.branchset.forEach(child => {
            data.branches.push([
              getName(parent),
              getName(child),
              Math.max(child.length, 0),
            ]);
            traverse(child);
          });
        }
      };
      traverse(newickTree);
      data.root = getName(newickTree);
    } else {
      // no Newick tree was specified, so build a quick-and-dirty distance matrix with Jukes-Cantor, and get a tree by neighbor-joining
      const taxa = Object.keys(data.rowData).sort();
      const seqs = taxa.map(taxon => data.rowData[taxon]);
      console.warn(`Estimating phylogenetic tree (${taxa.length} taxa)...`);
      const distMatrix = JukesCantor.calcFiniteDistanceMatrix(seqs);
      const rnj = new RapidNeighborJoining.RapidNeighborJoining(
        distMatrix,
        taxa.map(name => ({ name })),
      );
      rnj.run();
      const tree = rnj.getAsObject();
      let nodes = 0;
      const getName = obj => {
        obj.taxon = obj.taxon || { name: `node${++nodes}` };
        return obj.taxon.name;
      };
      data.branches = [];
      const traverse = parent => {
        // auto-name internal nodes
        parent.children.forEach(child => {
          data.branches.push([
            getName(parent),
            getName(child),
            Math.max(child.length, 0),
          ]);
          traverse(child);
        });
      };
      traverse(tree);
      data.root = getName(tree);
    }
  }
  this.guessSeqCoords(data); // this is an idempotent method; if data came from a Stockholm file, it's already been called (in order to filter out irrelevant structures)
  return data;
}
