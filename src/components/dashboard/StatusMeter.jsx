import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const StatusMeter = ({ label, valueLabel, percent = 0, color = "primary" }) => (
  <Box py={1.25}>
    <Stack direction="row" justifyContent="space-between" gap={2} mb={0.75}>
      <Typography variant="body2" fontWeight={600} noWrap>
        {label}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valueLabel}
      </Typography>
    </Stack>
    <LinearProgress
      variant="determinate"
      value={Math.max(0, Math.min(100, Number(percent) || 0))}
      color={color}
      sx={{ height: 8, borderRadius: 99 }}
    />
  </Box>
);

export default StatusMeter;
