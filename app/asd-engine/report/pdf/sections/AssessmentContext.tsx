import { View } from "@react-pdf/renderer";
import { TEXLEX_ASSESSMENT_CONTEXT, TEXLEX_CONSENT } from "../../constants/texlexBoilerplate";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function AssessmentContext() {
  return (
    <View>
      <SectionHeading title="Assessment context" />
      <ProseParagraphs text={TEXLEX_ASSESSMENT_CONTEXT} variant="boilerplate" />
      <SectionHeading title="Consent and use of report" />
      <ProseParagraphs text={TEXLEX_CONSENT} variant="boilerplate" />
    </View>
  );
}
