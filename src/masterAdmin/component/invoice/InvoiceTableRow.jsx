import { Text, View, StyleSheet } from "@react-pdf/renderer";

const borderColor = "#122159";
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomColor: "#122159",
    borderBottomWidth: 1,
    alignItems: "center",
    height: 24,
  },
  description: {
    width: "75%",
    textAlign: "left",
    borderRightColor: borderColor,
    borderRightWidth: 1,
    paddingLeft: 8,
  },

  amount: {
    width: "25%",
    textAlign: "right",
    paddingRight: 8,
  },
});

const InvoiceTableRow = ({ paymentTable }) => (
  <View style={styles.row}>
    <Text style={styles.description}>{paymentTable?.description}</Text>
    <Text style={styles.amount}>{paymentTable?.subTotal}</Text>
  </View>
);

export default InvoiceTableRow;
