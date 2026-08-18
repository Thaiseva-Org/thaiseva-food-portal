import { ThemeProvider } from "@mui/material/styles";
import { dashTheme } from "./dashTheme";

const DashboardTheme = ({ children }) => (
  <ThemeProvider theme={dashTheme}>{children}</ThemeProvider>
);

export default DashboardTheme;
