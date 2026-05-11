import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";

export function SectionHeading({ title }: { title: string }) {
  return (
    <View style={styles.sectionHeadingWrap}>
      <Text style={styles.sectionHeading}>{title}</Text>
    </View>
  );
}
