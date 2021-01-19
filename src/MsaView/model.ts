import PluginManager from "@jbrowse/core/PluginManager";
import { indexData } from "./util";

export default function(pluginManager: PluginManager) {
  const { jbrequire } = pluginManager;
  const { types } = pluginManager.lib["mobx-state-tree"];
  const { ElementId } = jbrequire("@jbrowse/core/util/types/mst");
  const { openLocation } = jbrequire("@jbrowse/core/util/io");
  const { BaseViewModel } = pluginManager.lib[
    "@jbrowse/core/pluggableElementTypes/models"
  ];

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
      })
      .volatile(() => ({
        error: undefined as Error | undefined,
        volatileWidth: 0,
        drawn: false,
        margin: { left: 20, top: 20 },
        hoverColumn: null,
      }))
      .actions((self: any) => ({
        async setDataset(obj: any) {
          const ret = await openLocation(obj).readFile("utf8");
          self.setData(ret);
        },

        setData(str: string) {
          self.mydata = str;
        },
        setScroll(left: number, top: number) {
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
        setDrawn(flag: boolean) {
          self.drawn = flag;
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
      })),
  );
}
