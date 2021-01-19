import App from "./App";
import ImportForm from "./ImportForm";
import PluginManager from "@jbrowse/core/PluginManager";
import dataset1 from "./dataset1";

const opts = {
  datasets: [
    dataset1,
    {
      name: "Corona_S2",
      url: { stockholm: "%PUBLIC_URL%/PF01601_full.txt" },
    },
  ],
  config: {
    containerHeight: "1000px",
    handler: {
      click: (coords: any) => {
        console.warn(
          `Click ${coords.node} column ${coords.column}${
            coords.isGap ? "" : `, position ${coords.seqPos}`
          } (${coords.c})`,
        );
      },
    },
  },
};

export default (pluginManager: PluginManager) => {
  const { jbrequire } = pluginManager;
  const { observer } = jbrequire("mobx-react");
  const React = jbrequire("react");
  const AppComponent = jbrequire(App);
  const ImportFormComponent = jbrequire(ImportForm);

  return observer(({ model }: { model: any }) => {
    const { data, initialized } = model;

    if (!initialized) {
      return null;
    }

    if (!data) {
      return <ImportFormComponent model={model} />;
    }

    return <AppComponent {...opts} model={model} />;
  });
};
