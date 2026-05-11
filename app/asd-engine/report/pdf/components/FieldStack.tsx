import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";

export function FieldStack({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldStack}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}
