import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";

export function FieldStack({ label, value }: { label: string; value: string }) {
  const safe = typeof value === "string" ? value : String(value ?? "");
  return (
    <View style={styles.fieldStack}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{safe}</Text>
    </View>
  );
}
