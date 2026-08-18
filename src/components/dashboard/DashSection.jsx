import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const DashSection = ({ title, subtitle, action, children, sx }) => (
  <Paper sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 3, height: "100%", ...sx }}>
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems={{ sm: "flex-start" }}
      justifyContent="space-between"
      mb={2}
    >
      <Box minWidth={0}>
        <Typography variant="h6">{title}</Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" mt={0.25}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box flexShrink={0}>{action}</Box> : null}
    </Stack>
    {children}
  </Paper>
);

export default DashSection;
