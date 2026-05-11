import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";
import { formatRatingPillText } from "../utils";

export function RatingPill({ rating }: { rating: 0 | 1 | 2 | 3 }) {
  return (
    <View style={styles.ratingPill}>
      <Text style={styles.ratingPillText}>{formatRatingPillText(rating)}</Text>
    </View>
  );
}
