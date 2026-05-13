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
          render={({ pageNumber, totalPages }) => {
            const p = Number.isFinite(pageNumber) ? Math.max(1, Math.floor(pageNumber)) : 1;
            const t = Number.isFinite(totalPages) ? Math.max(1, Math.floor(totalPages)) : 1;
            return `Page ${p} of ${t}`;
          }}
        />
      </View>
    </View>
  );
}
