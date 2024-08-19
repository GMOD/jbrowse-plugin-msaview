export function a11yProps(index: number) {
  return {
    id: `gtab-${index}`,
    'aria-controls': `gtabpanel-${index}`,
  }
}
