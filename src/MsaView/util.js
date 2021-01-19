export function indexData(data) {
  const treeIndex = buildTreeIndex(data);
  const alignIndex = buildAlignmentIndex(data);
  return { data, treeIndex, alignIndex };
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
    const rowAsArray = this.rowAsArray(row);
    alignColToSeqPos[node] = rowAsArray.map((c, col) => {
      if (typeof c === "string") {
        isChar[c] = true;
      }
      const isGap = this.isGapChar(c);
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
  const roots = this.getRoots(branches);
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
