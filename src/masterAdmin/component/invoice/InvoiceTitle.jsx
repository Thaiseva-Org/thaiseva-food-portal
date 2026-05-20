import { Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTitle: {
    color: "#122159",
    letterSpacing: 1,
    fontSize: 18,
    textAlign: "center",
    textTransform: "uppercase",
  },
});

const InvoiceTitle = ({ title }) => (
  <View style={styles.titleContainer}>
    <Text style={styles.reportTitle}>{title}</Text>
  </View>
);

export default InvoiceTitle;
