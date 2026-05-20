import { View, StyleSheet } from "@react-pdf/renderer";
import InvoiceTableHeader from "./InvoiceTableHeader";
import InvoiceTableRow from "./InvoiceTableRow";
import InvoiceTableBlankSpace from "./InvoiceTableBlankSpace";
import InvoiceTableFooter from "./InvoiceTableFooter";

const tableRowsCount = 3;

const styles = StyleSheet.create({
  tableContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#122159",
    marginLeft: 15,
    marginRight: 15,
  },
});

const InvoiceItemsTable = ({ paymentTable, type }) => {
  return (
    <View style={styles.tableContainer}>
      <InvoiceTableHeader />
      <InvoiceTableRow paymentTable={paymentTable} />
      <InvoiceTableBlankSpace rowsCount={tableRowsCount} />
      <InvoiceTableFooter paymentTable={paymentTable} type={type} />
    </View>
  );
};

export default InvoiceItemsTable;
