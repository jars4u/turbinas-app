import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: [
      'Poppins',
      'Arial',
      'Helvetica',
      'sans-serif',
    ].join(','),
  },
});

export default theme;
