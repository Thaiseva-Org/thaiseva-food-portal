import { createTheme } from "@mui/material/styles";

/** MUI theme mapped to ThaiSeva tokens in tailwind.config.js. */
export const dashTheme = createTheme({
  palette: {
    primary: { main: "#2563eb", dark: "#1d4ed8", light: "#3b82f6" },
    secondary: { main: "#f97316", dark: "#ea580c", light: "#fb923c" },
    success: { main: "#22c55e", dark: "#16a34a", light: "#4ade80" },
    warning: { main: "#f59e0b", dark: "#d97706" },
    error: { main: "#ef4444", dark: "#dc2626" },
    info: { main: "#3b82f6" },
    text: { primary: "#171717", secondary: "#525252" },
    divider: "#e5e5e5",
    background: { default: "#f8fafc", paper: "#ffffff" },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", system-ui, sans-serif',
    h4: { fontWeight: 800, letterSpacing: "-0.03em", color: "#1e3a8a" },
    h5: { fontWeight: 700, letterSpacing: "-0.02em", color: "#1e3a8a" },
    h6: { fontWeight: 700, letterSpacing: "-0.02em", color: "#1e3a8a" },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #e5e5e5",
          boxShadow:
            "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04)",
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          border: "1px solid #e5e5e5",
          boxShadow:
            "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04)",
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          fontSize: "0.8rem",
          padding: "4px 12px",
          borderRadius: 10,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});
