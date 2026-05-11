import { Text, View } from "@react-pdf/renderer";
import { TEXLEX_CRITERIA } from "../../constants/texlexBoilerplate";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { RatingPill } from "../components/RatingPill";
import { styles } from "../styles";
import type { CriterionCode, CriterionState } from "../types";
import { isInsufficientEvidenceNarrative } from "../utils";

export function CriterionBlock({
  code,
  criterion,
}: {
  code: CriterionCode;
  criterion: CriterionState;
}) {
  const meta = TEXLEX_CRITERIA[code];
  const displayRating =
    code === "A2" && isInsufficientEvidenceNarrative(criterion.indicators) ? null : criterion.rating;

  return (
    <View>
      <View style={styles.criterionHeadingRow}>
        <Text style={styles.criterionTitle}>{meta.title}</Text>
        {displayRating !== null ? <RatingPill rating={displayRating} /> : null}
      </View>
      <Text style={styles.criterionDescription}>{meta.description}</Text>
      <ProseParagraphs text={criterion.indicators} />
    </View>
  );
}
