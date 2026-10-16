import { createTheme, ThemeOptions } from '@mui/material/styles';
import { tokens, ThemeMode } from './designTokens';

export const createAppTheme = (mode: ThemeMode) => {
  const t = tokens[mode];

  const themeOptions: ThemeOptions = {
    palette: {
      mode,
      primary: {
        main: t.emeraldPrimary,
        light: t.emeraldLight,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: t.goldPrimary,
        contrastText: '#1E293B',
      },
      background: {
        default: t.bgMain,
        paper: mode === 'light' ? '#FFFFFF' : '#0F141D',
      },
      text: {
        primary: t.textPrimary,
        secondary: t.textSecondary,
      },
      success: {
        main: t.status.ok,
      },
      warning: {
        main: t.status.medio,
      },
      error: {
        main: t.status.critico,
      },
      info: {
        main: t.status.acompanhar,
      },
      divider: t.border,
    },
    typography: {
      fontFamily: tokens.fonts.primary,
      h1: { fontWeight: 700 },
      h2: { fontWeight: 700 },
      h3: { fontWeight: 600 },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 500 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: {
      borderRadius: 10,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 18px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 2px 8px rgba(13, 92, 58, 0.2)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${t.glassBorder}`,
            backgroundColor: t.glassBg,
            backdropFilter: 'blur(12px)',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
    },
  };

  return createTheme(themeOptions);
};
