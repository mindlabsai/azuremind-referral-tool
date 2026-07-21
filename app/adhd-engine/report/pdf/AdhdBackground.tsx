import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "@/app/asd-engine/report/pdf/components/ProseParagraphs";
import { SectionHeading } from "@/app/asd-engine/report/pdf/components/SectionHeading";
import { SubsectionHeading } from "@/app/asd-engine/report/pdf/components/SubsectionHeading";
import { isTexlexSubsectionEmpty } from "@/app/asd-engine/report/pdf/utils";
import type { AdhdPdfDraft } from "./types";

function BackgroundSubsection({ title, text }: { title: string; text: string }) {
  if (isTexlexSubsectionEmpty(text)) return null;
  return (
    <View>
      <SubsectionHeading title={title} />
      <ProseParagraphs text={text} />
    </View>
  );
}

export function AdhdBackground({ background }: { background: AdhdPdfDraft["background"] }) {
  return (
    <View>
      <SectionHeading title="Background" />
      <BackgroundSubsection title="Pregnancy and birth" text={background.pregnancyBirth} />
      <BackgroundSubsection title="Early development" text={background.earlyDevelopment} />
      <BackgroundSubsection title="Educational history" text={background.educationalHistory} />
      <BackgroundSubsection
        title="Emotional, behavioural and sensory"
        text={background.emotionalBehaviouralSensory}
      />
    </View>
  );
}
