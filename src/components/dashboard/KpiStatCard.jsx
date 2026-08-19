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

const CARD_SHADOW =
  "0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04)";

const KpiStatCard = ({ title, value, icon, tone = "blue", selected = false }) => {
  const colors = TONES[tone] || TONES.blue;
  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        borderRadius: 3,
        border: "1px solid",
        borderColor: selected ? colors.fg : "#e5e5e5",
        boxShadow: selected ? `0 0 0 2px ${colors.bg}` : CARD_SHADOW,
      }}
    >
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
              fontSize: 22,
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
