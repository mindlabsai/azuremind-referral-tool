import { Text, View } from "@react-pdf/renderer";
import { TEXLEX_CRITERIA } from "../../constants/texlexBoilerplate";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { RatingPill } from "../components/RatingPill";
import { styles } from "../styles";
import type { CriterionCode, CriterionState } from "../types";

export function CriterionBlock({
  code,
  criterion,
}: {
  code: CriterionCode;
  criterion: CriterionState;
}) {
  const meta = TEXLEX_CRITERIA[code];
  // Clinician rating only — never auto-suggested (import / typo-fix must stick on the PDF).
  const pillRating =
    criterion.rating !== null && [0, 1, 2, 3].includes(criterion.rating)
      ? (criterion.rating as 0 | 1 | 2 | 3)
      : null;

  return (
    <View>
      <View style={styles.criterionHeadingRow}>
        <Text style={[styles.criterionTitle, { marginRight: 8 }]}>{meta.title}</Text>
        {pillRating !== null ? <RatingPill rating={pillRating} /> : null}
      </View>
      <Text style={styles.criterionDescription}>{meta.description}</Text>
      <ProseParagraphs text={criterion.indicators} />
    </View>
  );
}
