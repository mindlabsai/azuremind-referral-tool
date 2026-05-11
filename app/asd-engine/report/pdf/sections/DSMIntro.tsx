import { Text, View } from "@react-pdf/renderer";
import {
  TEXLEX_CRITERION_A_HEADER,
  TEXLEX_DSM_INTRO,
  TEXLEX_RATING_GUIDE,
} from "../../constants/texlexBoilerplate";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";
import { SubsectionHeading } from "../components/SubsectionHeading";
import { styles } from "../styles";

export function DSMIntro() {
  return (
    <View>
      <SectionHeading title="DSM-5-TR criteria (A & B)" />
      <ProseParagraphs text={TEXLEX_DSM_INTRO} variant="boilerplate" />
      <SubsectionHeading title="Rating scale" />
      <View style={styles.ratingLegend}>
        {TEXLEX_RATING_GUIDE.map((rating) => (
          <View key={rating.value} style={styles.ratingLegendRow}>
            <Text style={styles.ratingLegendNumber}>{rating.value}</Text>
            <Text style={styles.ratingLegendLabel}>{rating.label}</Text>
          </View>
        ))}
      </View>
      <SubsectionHeading title={TEXLEX_CRITERION_A_HEADER.title} />
      <Text style={styles.domainDescription}>{TEXLEX_CRITERION_A_HEADER.description}</Text>
    </View>
  );
}
