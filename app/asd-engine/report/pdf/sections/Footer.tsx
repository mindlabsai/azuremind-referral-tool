import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";

export function Footer() {
  return (
    <View style={styles.footerWrap} fixed>
      <View style={styles.footerRule} />
      <View style={styles.footerRow}>
        <Text style={styles.footerLeft}>Azure Mind</Text>
        <Text style={styles.footerCenter}>Confidential</Text>
        <Text
          style={styles.footerRight}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    </View>
  );
}
