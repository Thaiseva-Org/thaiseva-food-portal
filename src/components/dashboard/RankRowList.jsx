import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";

const RankRowList = ({ items, emptyLabel = "Nothing to show yet." }) => {
  if (!items?.length) {
    return (
      <Box py={6} textAlign="center">
        <Typography variant="body2" color="text.secondary">
          {emptyLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <List disablePadding>
      {items.map((item) => (
        <ListItem
          key={item.id}
          disableGutters
          secondaryAction={
            <Typography
              variant="subtitle2"
              title={item.valueTitle}
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {item.value}
            </Typography>
          }
          sx={{ py: 1, pr: 10 }}
        >
          <ListItemAvatar>
            <Avatar
              variant="rounded"
              src={item.image}
              alt=""
              sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: "grey.100" }}
            />
          </ListItemAvatar>
          <ListItemText
            primary={item.title}
            secondary={item.subtitle}
            primaryTypographyProps={{ noWrap: true, fontWeight: 600 }}
            secondaryTypographyProps={{ noWrap: true }}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default RankRowList;
