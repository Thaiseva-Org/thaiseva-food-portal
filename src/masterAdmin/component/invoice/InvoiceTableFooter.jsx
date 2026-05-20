import { Text, View, StyleSheet } from "@react-pdf/renderer";

const borderColor = "#122159";
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderBottomColor: "#122159",
    borderBottomWidth: 1,
    alignItems: "center",
    height: 24,
    fontSize: 12,
  },
  description: {
    width: "75%",
    textAlign: "right",
    borderRightColor: borderColor,
    borderRightWidth: 1,
    paddingRight: 8,
  },
  total: {
    width: "25%",
    textAlign: "right",
    paddingRight: 8,
  },
});

const InvoiceTableFooter = ({ paymentTable, type }) => {
  let subTotal = paymentTable?.subTotal || 0;
  let commission = paymentTable?.commission || 0;
  let total = paymentTable?.total || 0;
  const totalCommission = paymentTable?.totalCommission || 0;
  console.log(type);

  return (
    <>
      <View style={styles.row}>
        <Text style={styles.description}>Sub TOTAL</Text>
        <Text style={styles.total}>{subTotal}</Text>
      </View>
      {type === "partner" ? (
        <View style={styles.row}>
          <Text style={styles.description}>{`Commission ${commission}%`}</Text>
          <Text style={styles.total}>{`-${totalCommission}`}</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={styles.description}>VAT 7%</Text>
          <Text style={styles.total}>{totalCommission}</Text>
        </View>
      )}
      <View style={styles.row}>
        <Text style={styles.description}>TOTAL</Text>
        <Text style={styles.total}>{total}</Text>
      </View>
    </>
  );
};

export default InvoiceTableFooter;
