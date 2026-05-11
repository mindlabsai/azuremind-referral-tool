import { Text } from "@react-pdf/renderer";
import { styles } from "../styles";

export function SubsectionHeading({ title }: { title: string }) {
  return <Text style={styles.subsectionHeading}>{title}</Text>;
}
