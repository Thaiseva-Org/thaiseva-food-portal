import { Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  footerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#122159",
    padding: "5px 15px",
  },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    color: "white",
    gap: 5,
  },
  contactItem: {
    fontSize: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  titleContainer: {
    flexDirection: "row",
  },
  reportTitle: {
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
    color: "yellow",
    textTransform: "capitalize",
  },
});

const InvoiceThankYouMsg = ({ contactInfo }) => (
  <View style={styles.footerContainer}>
    <View style={styles.contact}>
      <View style={styles.contactItem}>
        <Text>Phone : </Text>
        <Text>{contactInfo?.phone}</Text>
      </View>
      <View style={styles.contactItem}>
        <Text>Email : </Text>
        <Text>{contactInfo?.email}</Text>
      </View>
    </View>
    <View style={styles.titleContainer}>
      <Text style={styles.reportTitle}>Thank you for your business</Text>
    </View>
  </View>
);

export default InvoiceThankYouMsg;
