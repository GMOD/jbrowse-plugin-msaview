/* eslint-disable react/prop-types,react/sort-comp */

function getDimensions({
  width,
  height,
  scrollTop,
  scrollLeft,
  treeHeight,
  alignWidth,
}) {
  const top = Math.max(0, scrollTop);
  const left = Math.max(0, scrollLeft);
  const bottom = Math.min(treeHeight, scrollTop + height);
  const right = Math.min(alignWidth, scrollLeft + width);
  return {
    top,
    left,
    bottom,
    right,
    width: right - left,
    height: bottom - top,
  };
}
export default function(pluginManager) {
  const { jbrequire } = pluginManager;
  const React = jbrequire("react");
  const { useEffect, useRef } = React;
  const { observer } = jbrequire("mobx-react");
  const { makeStyles } = jbrequire("@material-ui/core/styles");
  const useStyles = makeStyles({
    alignmentCanvas: {
      position: "absolute",
      overflow: "hidden",
      pointerEvents: "none",
    },
  });

  function MSAAlignCanvas(props) {
    const canvasRef = useRef();
    const classes = useStyles();
    const {
      scrollLeft,
      scrollTop,
      computedFontConfig,
      alignLayout: { alignWidth },
      treeLayout,
      alignLayout,
      treeIndex,
      alignIndex,
      data,
      clientWidth,
      clientHeight,
    } = props;
    const { treeHeight } = treeLayout;
    function getColor(c) {
      const { color } = computedFontConfig;
      return color[c.toUpperCase()] || color.default || "black";
    }

    useEffect(() => {
      const alignCanvas = canvasRef.current;
      if (!canvasRef.current) {
        return;
      }

      const ctx = alignCanvas.getContext("2d");
      if (!ctx) {
        return;
      }

      const { top, left, bottom, right } = getDimensions({
        width: clientWidth,
        height: clientHeight,
        scrollTop,
        scrollLeft,
        treeHeight,
        alignWidth,
      });
      const { rowData } = data;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, clientWidth, clientHeight);
      ctx.font = computedFontConfig.charFont;
      let firstRow = 0;
      let lastRow;
      // firstRow is first (partially) visible row, lastRow is last (partially)
      // visible row
      for (
        let row = firstRow;
        row < treeLayout.rowHeight.length && treeLayout.rowY[row] < bottom;
        ++row
      ) {
        if (treeLayout.rowY[row] < top) {
          firstRow = row;
        }
        lastRow = row;
      }

      for (
        let col = 0, colX = 0;
        col < alignIndex.columns && colX < right;
        ++col
      ) {
        const xScale = alignLayout.computedColScale[col];
        colX = alignLayout.colX[col];
        const width = alignLayout.colWidth[col];
        if (xScale && colX + width >= left) {
          for (let row = firstRow; row <= lastRow; ++row) {
            const yScale = treeLayout.computedRowScale[row];
            const rowY = treeLayout.rowY[row];
            const height = treeLayout.rowHeight[row];
            const seq = rowData[treeIndex.nodes[row]];
            if (height && seq) {
              const c = seq[col];
              if (typeof c === "string") {
                ctx.fillStyle = getColor(c);
                ctx.setTransform(
                  xScale,
                  0,
                  0,
                  yScale,
                  colX - left,
                  rowY + height - top,
                );
                ctx.fillText(c, 0, 0);
              } else {
                let psum = 0;
                for (let i = 0; i < c.length; i++) {
                  const cp = c[i];
                  const ci = cp[0];
                  const p = cp[1];
                  ctx.setTransform(
                    xScale,
                    0,
                    0,
                    yScale * p,
                    colX - left,
                    rowY + height * (1 - psum) - top,
                  );
                  ctx.fillStyle = getColor(ci);
                  ctx.fillText(ci, 0, 0);
                  psum += p;
                }
              }
            }
          }
        }
      }
    }, [scrollLeft, clientWidth, clientHeight, treeLayout.computedRowScale]);

    const { top, left } = getDimensions({
      width: clientWidth,
      height: clientHeight,
      scrollTop,
      scrollLeft,
      alignWidth,
      treeHeight,
    });
    return (
      <canvas
        classes={classes.alignmentCanvas}
        ref={canvasRef}
        width={clientWidth}
        height={clientHeight}
        style={{
          position: "absolute",
          top,
          left,
        }}
      />
    );
  }

  return observer(MSAAlignCanvas);
}
