import { createContext, useContext } from 'react';
import { createTheme, type Theme } from '@mui/material/styles';

// Design tokens
export const designTokens = {
  spacing: {
    drawerWidth: 280,
    drawerWidthDev: 320,
  },
  borderRadius: {
    small: 4,
    medium: 8,
    large: 16,
  },
  shadows: {
    low: '0 1px 3px rgba(0, 0, 0, 0.12)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.1)',
    high: '0 10px 20px rgba(0, 0, 0, 0.15)',
    dark: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
  transitions: {
    fast: '150ms',
    standard: '300ms',
    slow: '500ms',
  }
};

// Color palettes
export const lightPalette = {
  text: '#1a1a1a',
  primaryInterface: '#ffffff',
  paperBackground: '#f8f9fa',
  notificationBg: '#007bff',
  lightGray: '#f0f0f0',
  borderLight: '#e0e0e0',
  drawerBackground: '#ffffff',
  expandedBackground: '#f3f7fa',
  activeBackground: '#f5f5f5',
  borders: '#e0e0e0',
  hoverBackground: '#f5f5f5'
} as typeof darkPalette;

export const darkPalette = {
  text: '#e0e0e0',
  primaryInterface: '#2d3748',
  paperBackground: '#1a202c',
  notificationBg: '#4299e1',
  lightGray: '#4a5568',
  borderLight: '#4a5568',
  drawerBackground: '#272e3d',
  expandedBackground: '#19222b',
  activeBackground: '#2d3748',
  borders: '#4a5568',
  hoverBackground: '#374151'
};

// Global component overrides that both themes will use
const globalComponentOverrides = {
  MuiDrawer: {
    styleOverrides: {
      paper: {
        width: '280px',
        // Color will be set via theme-specific overrides below
      }
    }
  },
  MuiAccordion: {
    styleOverrides: {
      root: {
        backgroundColor: 'transparent',
        boxShadow: 'none',
        border: 'none',
        borderRadius: 0,
        margin: 0,
        '&:before': {
          display: 'none',
        },
        '&.Mui-expanded': {
          margin: 0,
        },
      }
    }
  },
  MuiAccordionSummary: {
    styleOverrides: {
      root: {
        backgroundColor: 'transparent',
        height: '36px',
        minHeight: '36px',
        maxHeight: '36px',
        padding: '0 16px',
        fontSize: '0.875rem',
        '& .MuiAccordionSummary-content': {
          margin: '8px 0',
        },
        '& .MuiAccordionSummary-expandIconWrapper': {
          fontSize: '1.2rem',
        },
        '&.Mui-expanded': {
          minHeight: '36px',
          height: '36px',
        },
      }
    }
  },
  MuiAccordionDetails: {
    styleOverrides: {
      root: {
        padding: '8px 16px 12px',
      }
    }
  },
  MuiTabs: {
    styleOverrides: {
      root: {
        minHeight: '36px',
        '& .MuiTab-root': {
          minWidth: '60px',
          padding: '6px 8px',
          minHeight: '36px',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
        },
      }
    }
  },
  MuiTextField: {
    styleOverrides: {
      root: {
        '& .MuiInputBase-input': {
          padding: '6px 8px',
        },
        '& .MuiInputLabel-root': {
          fontSize: '0.8rem',
        },
        '& .MuiOutlinedInput-root': {
          fontSize: '0.8rem',
        },
        // Drawer-specific spacing
        '.MuiDrawer-paper &': {
          marginBottom: '10px',
        },
      }
    }
  },
  MuiButton: {
    styleOverrides: {
      root: {
        textTransform: 'none',
        borderRadius: designTokens.borderRadius.medium,
        fontSize: '0.65rem',
      }
    }
  },
  MuiFormControlLabel: {
    styleOverrides: {
      root: {
        fontSize: '0.875rem',
        marginBottom: '8px',
      }
    }
  },
  MuiSlider: {
    styleOverrides: {
      root: {
        marginBottom: '12px',
      }
    }
  },
  MuiChip: {
    styleOverrides: {
      root: {
        fontSize: '0.7rem',
        height: '24px',
        '& .MuiChip-label': {
          padding: '0 6px'
        },
      }
    }
  },
};

// Light theme
export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: lightPalette.notificationBg,
      contrastText: lightPalette.text,
    },
    background: {
      default: lightPalette.paperBackground,
      paper: lightPalette.primaryInterface,
    },
    text: {
      primary: lightPalette.text,
      secondary: `${lightPalette.text}CC`,
    },
    grey: {
      100: lightPalette.lightGray,
      300: lightPalette.borderLight,
      400: lightPalette.borderLight,
      500: lightPalette.borders,
      800: lightPalette.activeBackground,
      900: lightPalette.expandedBackground,
    },
    divider: lightPalette.borderLight,
    action: {
      hover: lightPalette.hoverBackground,
      selected: lightPalette.activeBackground,
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 500,
    }
  },
  shape: {
    borderRadius: designTokens.borderRadius.medium,
  },
  transitions: {
    duration: {
      standard: 300,
      short: 200,
      complex: 500,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    }
  },
  components: {
    // Spread global overrides
    ...globalComponentOverrides,

    // Light theme specific overrides
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: designTokens.shadows.medium,
          backgroundColor: lightPalette.primaryInterface,
          color: lightPalette.text,
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          width: '280px',
          backgroundColor: lightPalette.primaryInterface,
          borderLeft: `1px solid ${lightPalette.borderLight}`,
          // Inverse theme for drawer - use dark colors when main is light
          '&.MuiDrawer-paper': {
            backgroundColor: darkPalette.drawerBackground,
            borderLeft: `1px solid ${darkPalette.borders}`,
          }
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiTabs.styleOverrides.root,
          backgroundColor: lightPalette.primaryInterface,
          borderBottom: `1px solid ${lightPalette.borderLight}`,
          '& .MuiTab-root': {
            ...globalComponentOverrides.MuiTabs.styleOverrides.root['& .MuiTab-root'],
            color: `${lightPalette.text}CC`,
            '&.Mui-selected': {
              color: lightPalette.text,
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: lightPalette.text,
          },
          // Inverse theme for drawer tabs
          '.MuiDrawer-paper &': {
            backgroundColor: darkPalette.drawerBackground,
            borderBottom: `1px solid ${darkPalette.borders}`,
            '& .MuiTab-root': {
              color: `${darkPalette.text}CC`,
              '&.Mui-selected': {
                color: darkPalette.text,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: darkPalette.text,
            },
          },
        }
      }
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordion.styleOverrides.root,
          // Inverse theme for drawer accordions
          '.MuiDrawer-paper &': {
            backgroundColor: 'transparent',
            borderBottom: `1px solid ${darkPalette.borders}`,
            '&.Mui-expanded': {
              backgroundColor: 'transparent',
            },
          },
        }
      }
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionSummary.styleOverrides.root,
          color: lightPalette.text,
          // Inverse theme for drawer accordion summaries
          '.MuiDrawer-paper &': {
            color: darkPalette.text,
            '&.Mui-expanded': {
              backgroundColor: darkPalette.expandedBackground,
            },
          },
        }
      }
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionDetails.styleOverrides.root,
          color: lightPalette.text,
          // Inverse theme for drawer accordion details
          '.MuiDrawer-paper &': {
            backgroundColor: darkPalette.expandedBackground,
            color: darkPalette.text,
          },
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiTextField.styleOverrides.root,
          '& .MuiOutlinedInput-root': {
            backgroundColor: lightPalette.primaryInterface,
            color: lightPalette.text,
            fontSize: '0.8rem',
            '& fieldset': {
              borderColor: lightPalette.borderLight,
            },
            '&:hover fieldset': {
              borderColor: lightPalette.text,
            },
            '&.Mui-focused fieldset': {
              borderColor: lightPalette.notificationBg,
            },
          },
          '& .MuiInputLabel-root': {
            color: `${lightPalette.text}CC`,
            fontSize: '0.8rem',
          },
          // Inverse theme for drawer text fields
          '.MuiDrawer-paper &': {
            marginBottom: '10px',
            '& .MuiOutlinedInput-root': {
              backgroundColor: darkPalette.expandedBackground,
              color: darkPalette.text,
              '& fieldset': {
                borderColor: darkPalette.borders,
              },
            },
            '& .MuiInputLabel-root': {
              color: `${darkPalette.text}CC`,
            },
          },
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: designTokens.borderRadius.medium,
          fontSize: '0.65rem',
          color: lightPalette.text,
        }
      }
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiFormControlLabel.styleOverrides.root,
          color: lightPalette.text,
          // Inverse theme for drawer form controls
          '.MuiDrawer-paper &': {
            color: darkPalette.text,
          },
        }
      }
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: lightPalette.text,
          // Inverse theme for drawer typography
          '.MuiDrawer-paper &': {
            color: darkPalette.text,
          },
        }
      }
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiSlider.styleOverrides.root,
          color: lightPalette.notificationBg,
          // Inverse theme for drawer sliders
          '.MuiDrawer-paper &': {
            color: darkPalette.notificationBg,
            '& .MuiSlider-thumb': {
              color: darkPalette.notificationBg
            },
            '& .MuiSlider-track': {
              color: darkPalette.notificationBg
            },
            '& .MuiSlider-rail': {
              color: darkPalette.borders
            },
          },
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiChip.styleOverrides.root,
          color: lightPalette.text,
          borderColor: lightPalette.borderLight,
          '&.MuiChip-filled': {
            backgroundColor: lightPalette.notificationBg,
            color: lightPalette.primaryInterface,
          },
          // Inverse theme for drawer chips
          '.MuiDrawer-paper &': {
            color: darkPalette.text,
            borderColor: darkPalette.borders,
            '&.MuiChip-filled': {
              backgroundColor: darkPalette.activeBackground,
              color: darkPalette.text,
            },
          },
        }
      }
    },
    MuiTable: {
      styleOverrides: {
        root: {
          backgroundColor: lightPalette.primaryInterface,
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: lightPalette.expandedBackground,
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: lightPalette.borderLight,
          color: lightPalette.text,
        },
        head: {
          backgroundColor: lightPalette.expandedBackground,
          color: lightPalette.text,
          fontWeight: 600,
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: lightPalette.hoverBackground,
          },
        }
      }
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          // Drawer-specific hover color for dark mode (inverse theme)
          '.MuiDrawer-paper &': {
            '&:hover': {
              backgroundColor: '#515864 !important',
            },
          },
        }
      }
    },
  }
});

// Dark theme
export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: darkPalette.notificationBg,
      contrastText: darkPalette.text,
    },
    background: {
      default: darkPalette.paperBackground,
      paper: darkPalette.primaryInterface,
    },
    text: {
      primary: darkPalette.text,
      secondary: `${darkPalette.text}CC`,
    },
    grey: {
      100: darkPalette.lightGray,
      300: darkPalette.borderLight,
      400: darkPalette.borderLight,
      500: darkPalette.borders,
      800: darkPalette.activeBackground,
      900: darkPalette.expandedBackground,
    },
    divider: darkPalette.borders,
    action: {
      hover: darkPalette.hoverBackground,
      selected: darkPalette.activeBackground,
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 500,
    }
  },
  shape: {
    borderRadius: designTokens.borderRadius.medium,
  },
  transitions: {
    duration: {
      standard: 300,
      short: 200,
      complex: 500,
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    }
  },
  components: {
    // Spread global overrides
    ...globalComponentOverrides,

    // Dark theme specific overrides
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: designTokens.shadows.dark,
          backgroundColor: darkPalette.primaryInterface,
          color: darkPalette.text,
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          width: '280px',
          backgroundColor: darkPalette.primaryInterface,
          borderLeft: `1px solid ${darkPalette.borders}`,
          // Inverse theme for drawer - use light colors when main is dark
          '&.MuiDrawer-paper': {
            backgroundColor: lightPalette.drawerBackground,
            borderLeft: `1px solid ${lightPalette.borderLight}`,
          }
        }
      }
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiTabs.styleOverrides.root,
          backgroundColor: darkPalette.drawerBackground,
          borderBottom: `1px solid ${darkPalette.borders}`,
          '& .MuiTab-root': {
            ...globalComponentOverrides.MuiTabs.styleOverrides.root['& .MuiTab-root'],
            color: `${darkPalette.text}CC`,
            '&.Mui-selected': {
              color: darkPalette.text,
            },
          },
          '& .MuiTabs-indicator': {
            backgroundColor: darkPalette.text,
          },
          // Inverse theme for drawer tabs
          '.MuiDrawer-paper &': {
            backgroundColor: lightPalette.primaryInterface,
            borderBottom: `1px solid ${lightPalette.borderLight}`,
            '& .MuiTab-root': {
              color: `${lightPalette.text}CC`,
              '&.Mui-selected': {
                color: lightPalette.text,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: lightPalette.text,
            },
          },
        }
      }
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordion.styleOverrides.root,
          // Inverse theme for drawer accordions
          '.MuiDrawer-paper &': {
            backgroundColor: 'transparent',
            borderBottom: `1px solid ${lightPalette.borderLight}`,
            '&.Mui-expanded': {
              backgroundColor: 'transparent',
            },
          },
        }
      }
    },
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionSummary.styleOverrides.root,
          color: darkPalette.text,
          // Inverse theme for drawer accordion summaries
          '.MuiDrawer-paper &': {
            color: lightPalette.text,
            '&.Mui-expanded': {
              backgroundColor: lightPalette.expandedBackground,
            },
          },
        }
      }
    },
    MuiAccordionDetails: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiAccordionDetails.styleOverrides.root,
          color: darkPalette.text,
          // Inverse theme for drawer accordion details
          '.MuiDrawer-paper &': {
            backgroundColor: lightPalette.expandedBackground,
            color: lightPalette.text,
          },
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiTextField.styleOverrides.root,
          '& .MuiOutlinedInput-root': {
            backgroundColor: darkPalette.expandedBackground,
            color: darkPalette.text,
            fontSize: '0.8rem',
            '& fieldset': {
              borderColor: darkPalette.borders,
            },
            '&:hover fieldset': {
              borderColor: darkPalette.borderLight,
            },
            '&.Mui-focused fieldset': {
              borderColor: darkPalette.notificationBg,
            },
          },
          '& .MuiInputLabel-root': {
            color: `${darkPalette.text}CC`,
            fontSize: '0.8rem',
          },
          // Inverse theme for drawer text fields
          '.MuiDrawer-paper &': {
            marginBottom: '10px',
            '& .MuiOutlinedInput-root': {
              backgroundColor: lightPalette.expandedBackground,
              color: lightPalette.text,
              '& fieldset': {
                borderColor: lightPalette.borderLight,
              },
            },
            '& .MuiInputLabel-root': {
              color: `${lightPalette.text}CC`,
            },
          },
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: designTokens.borderRadius.medium,
          fontSize: '0.65rem',
          color: darkPalette.text,
        }
      }
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: darkPalette.text,
        }
      }
    },
    MuiFormControlLabel: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiFormControlLabel.styleOverrides.root,
          color: darkPalette.text,
          // Inverse theme for drawer form controls
          '.MuiDrawer-paper &': {
            color: lightPalette.text,
          },
        }
      }
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          color: darkPalette.text,
          // Inverse theme for drawer typography
          '.MuiDrawer-paper &': {
            color: lightPalette.text,
          },
        }
      }
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiSlider.styleOverrides.root,
          color: darkPalette.notificationBg,
          // Inverse theme for drawer sliders
          '.MuiDrawer-paper &': {
            color: lightPalette.notificationBg,
            '& .MuiSlider-thumb': {
              color: lightPalette.notificationBg
            },
            '& .MuiSlider-track': {
              color: lightPalette.notificationBg
            },
            '& .MuiSlider-rail': {
              color: lightPalette.borderLight
            },
          },
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          ...globalComponentOverrides.MuiChip.styleOverrides.root,
          color: darkPalette.text,
          borderColor: darkPalette.borders,
          '&.MuiChip-filled': {
            backgroundColor: darkPalette.activeBackground,
            color: darkPalette.text,
          },
          // Inverse theme for drawer chips
          '.MuiDrawer-paper &': {
            color: lightPalette.text,
            borderColor: lightPalette.borderLight,
            '&.MuiChip-filled': {
              backgroundColor: lightPalette.notificationBg,
              color: lightPalette.primaryInterface,
            },
          },
        }
      }
    },
    MuiTable: {
      styleOverrides: {
        root: {
          backgroundColor: darkPalette.primaryInterface,
        }
      }
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: darkPalette.expandedBackground,
        }
      }
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: darkPalette.borders,
          color: darkPalette.text,
        },
        head: {
          backgroundColor: darkPalette.expandedBackground,
          color: darkPalette.text,
          fontWeight: 600,
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: darkPalette.hoverBackground,
          },
        }
      }
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          // Drawer-specific hover color for light mode (inverse theme)
          '.MuiDrawer-paper &': {
            '&:hover': {
              backgroundColor: '#515864 !important',
            },
          },
        }
      }
    },
  }
});

// Theme context
export type ThemeMode = 'light' | 'dark';

export interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
  currentTheme: Theme;
  currentPalette: typeof lightPalette | typeof darkPalette;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Backward compatibility exports
export const muiTheme = lightTheme;

// Utility functions
export const getBoxShadow = (elevation: 'low' | 'medium' | 'high' | 'dark' = 'medium') => {
  return designTokens.shadows[elevation];
};

export const getTransition = (property = 'all', duration: 'fast' | 'standard' | 'slow' = 'standard') => {
  const durationValue = designTokens.transitions[duration];
  return `${property} ${durationValue}`;
};

export const getBorderRadius = (size: 'small' | 'medium' | 'large' = 'medium') => {
  return `${designTokens.borderRadius[size]}px`;
};

export const isDevelopment = import.meta.env.DEV;
export const getDrawerWidth = () => isDevelopment ? designTokens.spacing.drawerWidthDev : designTokens.spacing.drawerWidth;