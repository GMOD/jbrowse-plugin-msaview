/* eslint-disable react/prop-types,react/sort-comp */

import { getAncestralReconstruction } from "./reconstruction";
import colorSchemes from "./colorSchemes";
import MSAFactory from "./MSA";

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

    makeURL(url) {
      return url.replace("%PUBLIC_URL%", process.env.PUBLIC_URL);
    }

    //todo
    componentDidUpdate() {
      this.reconstructMissingNodes();
    }

    get nAlignQueryParam() {
      return "alignnum";
    }

    get alignIdQueryParam() {
      return "alignid";
    }

    // check if any nodes are missing; if so, do ancestral sequence reconstruction
    reconstructMissingNodes() {
      const { data } = this.props.model;
      let promise;
      if (data) {
        const { branches } = data;
        const rowData = { ...data.rowData };
        const missingAncestors = data.branches.filter(
          b => typeof rowData[b[0]] === "undefined",
        ).length;
        if (missingAncestors && !this.state.reconstructingAncestors) {
          this.setState({ reconstructingAncestors: true });

          promise = getAncestralReconstruction({ branches, rowData }).then(
            result => {
              this.incorporateAncestralReconstruction(result.ancestralRowData);
            },
          );
        }
      } else {
        promise = Promise.resolve();
      }
      return promise;
    }

    fn2workerURL(fn) {
      const blob = new Blob([`(${fn.toString()})()`], {
        type: "application/javascript",
      });
      return URL.createObjectURL(blob);
    }

    incorporateAncestralReconstruction(ancestralRowData) {
      const { data } = this.props.model;
      const rowData = { ...data.rowData, ...ancestralRowData };
      Object.assign(data, { rowData });
      this.setDataset(data); // rebuilds indices
    }

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

    render() {
      const { model } = this.props;
      const { data } = model;

      return (
        <MSA
          ref={this.msaRef}
          data={data}
          config={this.state.config}
          view={this.state.view}
          computedTreeConfig={this.state.computedTreeConfig}
          computedFontConfig={this.state.computedFontConfig}
          model={model}
        />
      );
    }
  }

  return withStyles(styles)(App);
}
