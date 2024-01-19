import { makeStyles } from 'tss-react/mui'

export const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    background: 'rgba(255,255,0,0.2)',
    border: '1px solid rgba(50,50,0,0.2)',
    position: 'absolute',
    zIndex: 1000,
    textAlign: 'center',
    pointerEvents: 'none',
    overflow: 'hidden',
  },
})
