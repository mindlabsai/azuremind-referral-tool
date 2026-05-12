import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";
import { SubsectionHeading } from "../components/SubsectionHeading";
import type { BackgroundPdfState } from "../types";
import { BACKGROUND_EMOTIONAL_EMPTY_FALLBACK, isTexlexSubsectionEmpty } from "../utils";

function BackgroundSubsection({
  title,
  text,
  emptyLabel,
}: {
  title: string;
  text: string;
  emptyLabel?: string;
}) {
  if (isTexlexSubsectionEmpty(text) && !emptyLabel) return null;

  return (
    <View>
      <SubsectionHeading title={title} />
      <ProseParagraphs text={text} emptyLabel={emptyLabel} />
    </View>
  );
}

export function Background({ background }: { background: BackgroundPdfState }) {
  return (
    <View>
      <SectionHeading title="Background" />
      <BackgroundSubsection title="Pregnancy and birth" text={background.pregnancyBirth} />
      <BackgroundSubsection title="Early development" text={background.earlyDevelopment} />
      <BackgroundSubsection title="Educational history" text={background.educationalHistory} />
      <BackgroundSubsection
        title="Emotional, behavioural and sensory"
        text={background.emotionalBehaviouralSensory}
        emptyLabel={BACKGROUND_EMOTIONAL_EMPTY_FALLBACK}
      />
    </View>
  );
}
