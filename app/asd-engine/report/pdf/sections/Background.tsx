import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";
import { SubsectionHeading } from "../components/SubsectionHeading";
import type { BackgroundPdfState } from "../types";
import { BACKGROUND_EMOTIONAL_EMPTY_FALLBACK } from "../utils";

export function Background({ background }: { background: BackgroundPdfState }) {
  return (
    <View>
      <SectionHeading title="Background" />
      <SubsectionHeading title="Pregnancy and birth" />
      <ProseParagraphs text={background.pregnancyBirth} />
      <SubsectionHeading title="Early development" />
      <ProseParagraphs text={background.earlyDevelopment} />
      <SubsectionHeading title="Educational history" />
      <ProseParagraphs text={background.educationalHistory} />
      <SubsectionHeading title="Emotional, behavioural and sensory" />
      <ProseParagraphs
        text={background.emotionalBehaviouralSensory}
        emptyLabel={BACKGROUND_EMOTIONAL_EMPTY_FALLBACK}
      />
    </View>
  );
}
