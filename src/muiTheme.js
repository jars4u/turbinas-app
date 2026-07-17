import React from 'react';
import { createTheme } from '@mui/material/styles';
import Slide from '@mui/material/Slide';

// Transición deslizante hacia arriba: da a los diálogos una sensación de
// "bottom sheet" al abrirse, especialmente en móvil.
const SlideUpTransition = React.forwardRef(function SlideUpTransition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#1E3A5F',
      light: '#3D5A80',
      dark: '#122A45',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#F5A623',
      contrastText: '#1E293B',
    },
    background: {
      default: '#F8FAFC',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E293B',
      secondary: '#64748B',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: [
      'Poppins',
      'Arial',
      'Helvetica',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiDialog: {
      defaultProps: {
        TransitionComponent: SlideUpTransition,
      },
      styleOverrides: {
        container: ({ theme }) => ({
          [theme.breakpoints.down('sm')]: {
            alignItems: 'flex-end',
          },
        }),
        paper: ({ theme }) => ({
          [theme.breakpoints.down('sm')]: {
            margin: 0,
            width: '100%',
            maxWidth: '100%',
            borderRadius: '16px 16px 0 0',
            // Deja visible una franja del fondo (dashboard) para que se sienta
            // como una superposición clásica y no como una pantalla nueva.
            maxHeight: '80vh',
          },
          '&.MuiDialog-paperFullScreen': {
            borderRadius: 0,
            maxHeight: '100%',
          },
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(2, 3),
          [theme.breakpoints.down('sm')]: {
            padding: theme.spacing(1.25, 2),
          },
        }),
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(1, 3),
          [theme.breakpoints.down('sm')]: {
            padding: theme.spacing(1, 2),
          },
        }),
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(1.5, 3),
          [theme.breakpoints.down('sm')]: {
            padding: theme.spacing(1, 2),
          },
        }),
      },
    },
  },
});

export default theme;
