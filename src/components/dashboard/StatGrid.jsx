import Box from "@mui/material/Box";

const COLUMNS = {
  4: {
    xs: "1fr",
    sm: "1fr 1fr",
    lg: "repeat(4, minmax(0, 1fr))",
  },
  5: {
    xs: "1fr",
    sm: "1fr 1fr",
    xl: "repeat(5, minmax(0, 1fr))",
  },
  6: {
    xs: "1fr",
    sm: "1fr 1fr",
    lg: "repeat(3, minmax(0, 1fr))",
    xl: "repeat(6, minmax(0, 1fr))",
  },
};

const StatGrid = ({ children, columns = 5, sx }) => (
  <Box
    sx={{
      mt: 2.5,
      display: "grid",
      gap: 2,
      gridTemplateColumns: COLUMNS[columns] || COLUMNS[5],
      minWidth: 0,
      ...sx,
    }}
  >
    {children}
  </Box>
);

export default StatGrid;
