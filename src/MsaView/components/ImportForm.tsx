import PluginManager from "@jbrowse/core/PluginManager";
import dataset1 from "./dataset1.js";

export default function(pluginManager: PluginManager) {
  const { jbrequire } = pluginManager;
  const React = pluginManager.lib["react"];
  const { useState } = React;
  const { observer } = jbrequire("mobx-react");
  const { makeStyles } = pluginManager.lib["@material-ui/core/styles"];
  const { FileSelector } = jbrequire("@jbrowse/core/ui");
  const { Typography, Button, Link, Container, Grid } = jbrequire(
    "@material-ui/core",
  );

  const useStyles = makeStyles((theme: any) => ({
    importFormContainer: {
      padding: theme.spacing(2),
    },
    importFormEntry: {
      minWidth: 180,
    },
    padding: {
      padding: theme.spacing(4),
    },
  }));

  const ImportForm = observer(({ model }: { model: any }) => {
    const classes = useStyles();
    const [location, setLocation] = useState();

    function onOpenClick() {
      model.setDataset(location);
    }

    return (
      <Container className={classes.importFormContainer}>
        <Grid container justify="center" alignItems="center">
          <Grid item className={classes.padding}>
            <Typography>Specify a .stockholm file to open</Typography>
            <FileSelector
              name="Import stockholm file"
              description=""
              location={location}
              setLocation={setLocation}
              localFileAllowed
            />
          </Grid>
          <Grid item className={classes.padding}>
            <div>
              <Link
                href="#"
                onClick={event => {
                  event.preventDefault();
                  model.setData(dataset1);
                }}
              >
                Example: SARS-CoV2 Spike Protein
              </Link>
            </div>
            <div>
              <Link
                href="#"
                onClick={event => {
                  event.preventDefault();
                  model.setDataset();
                }}
              >
                Example: Corona
              </Link>
            </div>
          </Grid>
          <Grid item className={classes.padding}>
            <Button onClick={onOpenClick} variant="contained" color="primary">
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    );
  });

  return ImportForm;
}
