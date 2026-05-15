import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";
import { parseRecommendationsListItems } from "../utils";
import { SectionHeading } from "../components/SectionHeading";

export function Recommendations({ content }: { content: string }) {
  const items = parseRecommendationsListItems(content);

  return (
    <View>
      <SectionHeading title="Recommendations" />
      {items.length === 0 ? (
        <Text style={styles.recommendationText}>—</Text>
      ) : (
        <View style={styles.recommendationsList}>
          {items.map((item, i) => (
            <View key={i} style={styles.recommendationItem} wrap={false}>
              <Text style={styles.recommendationNumber}>{i + 1}.</Text>
              <Text style={styles.recommendationText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
