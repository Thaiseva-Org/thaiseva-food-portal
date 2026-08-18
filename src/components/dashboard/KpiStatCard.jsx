import Avatar from "@mui/material/Avatar";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatCount, formatCountFull } from "../../utils/format";

const TONES = {
  blue: { bg: "#dbeafe", fg: "#2563eb" },
  green: { bg: "#dcfce7", fg: "#16a34a" },
  red: { bg: "#fee2e2", fg: "#dc2626" },
  yellow: { bg: "#fef3c7", fg: "#d97706" },
  orange: { bg: "#ffedd5", fg: "#ea580c" },
  purple: { bg: "#fae8ff", fg: "#c026d3" },
};

const KpiStatCard = ({ title, value, icon, tone = "blue" }) => {
  const colors = TONES[tone] || TONES.blue;
  return (
    <Card sx={{ height: "100%", borderRadius: 3 }}>
      <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
        <Stack direction="row" spacing={1.75} alignItems="center">
          <Avatar
            variant="rounded"
            sx={{
              width: 48,
              height: 48,
              bgcolor: colors.bg,
              color: colors.fg,
              borderRadius: 2,
            }}
          >
            {icon}
          </Avatar>
          <Stack minWidth={0} flex={1}>
            <Typography
              variant="h5"
              title={formatCountFull(value)}
              sx={{
                lineHeight: 1.15,
                fontVariantNumeric: "tabular-nums",
                wordBreak: "break-word",
              }}
            >
              {formatCount(value)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.3, whiteSpace: "normal" }}
            >
              {title}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default KpiStatCard;
