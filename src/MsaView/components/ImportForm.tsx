import PluginManager from "@jbrowse/core/PluginManager";
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
  }));

  const ImportForm = observer(({ model }: { model: any }) => {
    const classes = useStyles();
    const [location, setLocation] = useState();

    function onOpenClick() {
      console.log(location);
      model.setDataset(location);
    }

    return (
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justify="center" alignItems="center">
          <Grid item>
            <Typography>Specify a .stockholm file to open</Typography>
            <FileSelector
              name="Import stockholm file"
              description=""
              location={location}
              setLocation={setLocation}
              localFileAllowed
            />
          </Grid>
          <Grid item>
            <Link onClick={() => model.setDataset()}>
              Example: SARS-CoV2 Spike Protein
            </Link>
            <Link onClick={() => model.setDataset()}>Example: Corona</Link>
          </Grid>
          <Grid item>
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
