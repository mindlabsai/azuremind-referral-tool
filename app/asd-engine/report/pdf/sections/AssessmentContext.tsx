import { View } from "@react-pdf/renderer";
import { TEXLEX_ASSESSMENT_CONTEXT, TEXLEX_CONSENT } from "../../constants/texlexBoilerplate";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function AssessmentContext({ modalityLead = "" }: { modalityLead?: string }) {
  const lead = modalityLead.trim();
  const text = lead ? `${lead}\n\n${TEXLEX_ASSESSMENT_CONTEXT}` : TEXLEX_ASSESSMENT_CONTEXT;
  return (
    <View>
      <SectionHeading title="Assessment context" />
      <ProseParagraphs text={text} variant="boilerplate" />
      <SectionHeading title="Consent and use of report" />
      <ProseParagraphs text={TEXLEX_CONSENT} variant="boilerplate" />
    </View>
  );
}
