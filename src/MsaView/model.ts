import PluginManager from "@jbrowse/core/PluginManager";
import { indexData, isGapChar } from "./util";

export default function(pluginManager: PluginManager) {
  const { jbrequire } = pluginManager;
  const { types } = pluginManager.lib["mobx-state-tree"];
  const { ElementId } = jbrequire("@jbrowse/core/util/types/mst");
  const { openLocation } = jbrequire("@jbrowse/core/util/io");
  const { BaseViewModel } = pluginManager.lib[
    "@jbrowse/core/pluggableElementTypes/models"
  ];

  const initialView = {
    // true if an internal node has been collapsed by the user
    collapsed: {},

    // force a node to be displayed even if it's flagged as collapsed.
    // Used by animation code
    forceDisplayNode: {},

    // height scaling factor for tree nodes / alignment rows. From 0 to 1
    // (undefined implies 1)
    nodeScale: {},

    // height scaling factor for alignment columns. From 0 to 1
    // (undefined implies 1)
    columnScale: {},
    disableTreeEvents: false,
    animating: false,
    structure: { openStructures: [] },
  };

  return types.compose(
    BaseViewModel,
    types
      .model("MsaView", {
        id: ElementId,
        type: types.literal("MsaView"),
        height: 600,
        treeWidth: 100,
        scrollTop: 0,
        alignScrollLeft: 0,
        mydata: types.frozen(),
        myview: types.frozen(initialView),
      })
      .volatile(() => ({
        error: undefined as Error | undefined,
        volatileWidth: 0,
        hoverColumn: null,
      }))
      .actions((self: any) => ({
        async setDataset(obj: any) {
          const ret = await openLocation(obj).readFile("utf8");
          self.setData(ret);
        },
        setView(view: any) {
          self.myview = view;
        },
        setData(str: string) {
          self.mydata = str;
        },
        resetView() {
          self.view = initialView;
        },
        setScroll(left: number, top: number) {
          console.log({ left, top });
          self.alignScrollLeft = left;
          self.scrollTop = top;
        },
        setHoverColumn(col: any) {
          self.hoverColumn = col;
        },
        setError(error?: Error) {
          self.error = error;
        },
        setWidth(width: number) {
          self.volatileWidth = width;
        },
      }))
      .views((self: any) => ({
        get initialized() {
          return self.volatileWidth > 0;
        },
        get menuItems() {
          return [];
        },

        get data() {
          return self.mydata ? indexData(self.mydata) : null;
        },

        get view() {
          return self.myview;
        },

        getComputedView() {
          const { data, view } = self;
          const { treeIndex, alignIndex } = data;
          const { collapsed, forceDisplayNode } = view;
          const { rowDataAsArray } = alignIndex;
          const ancestorCollapsed: { [key: string]: any } = {};
          const nodeVisible: { [key: string]: boolean } = {};
          const setCollapsedState = (node: string, parentNode?: string) => {
            if (parentNode) {
              ancestorCollapsed[node] =
                ancestorCollapsed[parentNode] || collapsed[parentNode];
            }
            const children = treeIndex.children[node];
            if (children) {
              children.forEach((child: string) =>
                setCollapsedState(child, node),
              );
            }
          };
          setCollapsedState(treeIndex.root);
          treeIndex.nodes.forEach((node: string) => {
            if (
              !ancestorCollapsed[node] &&
              (treeIndex.children[node].length === 0 || forceDisplayNode[node])
            ) {
              nodeVisible[node] = true;
            }
          });
          const columnVisible = new Array(alignIndex.columns).fill(false);
          treeIndex.nodes
            .filter((node: string) => nodeVisible[node])
            .forEach((node: string) => {
              if (rowDataAsArray[node]) {
                rowDataAsArray[node].forEach((c: string, col: number) => {
                  if (!isGapChar(c)) {
                    columnVisible[col] = true;
                  }
                });
              }
            });
          return {
            ancestorCollapsed,
            nodeVisible,
            columnVisible,
            ...view,
          };
        },
      })),
  );
}
