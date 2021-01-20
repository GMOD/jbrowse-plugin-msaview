/* eslint-disable react/prop-types */

const styles = {
  alignmentNames: {
    marginLeft: "2px",
    marginRight: "2px",
    overflowX: "scroll",
    overflowY: "hidden",
    flexShrink: "0",
    whiteSpace: "nowrap",
  },
  alignmentNamesContent: {
    position: "relative",
  },
  alignmentName: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  alignmentNameLink: {
    color: "blue",
    cursor: "pointer",
    textDecoration: "underline",
    "&:active": {
      color: "red",
    },
  },
};

export default function(pluginManager) {
  const { jbrequire } = pluginManager;
  const React = jbrequire("react");
  const { withStyles } = jbrequire("@material-ui/core/styles");

  class MSAAlignNames extends React.Component {
    render() {
      const {
        model,
        computedFontConfig,
        config,
        computedView,
        treeLayout,
        classes,
      } = this.props;
      const { scrollTop, data, view } = model;
      const { treeIndex, structure = {} } = data;
      const { nameDivWidth } = config;
      const { nameFontName, nameFontSize } = computedFontConfig;

      const { nodeHeight } = treeLayout;

      return (
        <div
          className={classes.alignmentNames}
          style={{
            fontFamily: nameFontName,
            fontSize: `${nameFontSize}px`,
            maxWidth: nameDivWidth,
          }}
        >
          <div
            className={classes.alignmentNamesContent}
            style={{ top: -scrollTop }}
          >
            {treeIndex.nodes
              .filter(node => computedView.nodeVisible[node])
              .map((node, row) => {
                const style = { height: nodeHeight[node] };
                const scale = view.nodeScale[node];
                if (scale !== undefined && scale !== 1) {
                  style.transform = `scale(1,${scale})`;
                  style.opacity = scale;
                }
                return (
                  <div
                    className={classes.alignmentName}
                    key={node}
                    style={style}
                  >
                    {structure[node] ? (
                      <span
                        className={classes.alignmentNameLink}
                        onClick={() => this.props.handleNameClick(node)}
                        style={{
                          fontFamily: nameFontName,
                          fontSize: `${nameFontSize}px`,
                        }}
                      >
                        {node}
                      </span>
                    ) : (
                      <span> {node} </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      );
    }
  }

  return withStyles(styles)(MSAAlignNames);
}
