import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SubsectionHeading } from "../components/SubsectionHeading";
import { isTexlexSubsectionEmpty } from "../utils";

export function CollateralSummary({ content }: { content: string }) {
  if (isTexlexSubsectionEmpty(content)) return null;

  return (
    <View>
      <SubsectionHeading title="Caregiver Observations (M-CHAT)" />
      <ProseParagraphs text={content} />
    </View>
  );
}
