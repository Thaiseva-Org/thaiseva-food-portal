import { Text, View, StyleSheet } from "@react-pdf/renderer";

const borderColor = "#122159";
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderBottomColor: "#122159",
    backgroundColor: "#122159",
    color: "white",
    borderBottomWidth: 1,
    alignItems: "center",
    height: 24,
    textAlign: "center",
    fontWeight: "bold",
    flexGrow: 1,
  },
  description: {
    width: "75%",
    borderRightColor: borderColor,
    borderRightWidth: 1,
  },
  amount: {
    width: "25%",
  },
});

const InvoiceTableHeader = () => (
  <View style={styles.container}>
    <Text style={styles.description}>Description</Text>
    <Text style={styles.amount}>Amount</Text>
  </View>
);

export default InvoiceTableHeader;
