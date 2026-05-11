import { View } from "@react-pdf/renderer";
import { styles } from "../styles";

export function HorizontalRule({ spacing = 20 }: { spacing?: 20 | 18 }) {
  return <View style={[styles.horizontalRule, { marginBottom: spacing }]} />;
}
