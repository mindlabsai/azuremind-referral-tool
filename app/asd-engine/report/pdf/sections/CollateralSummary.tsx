import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";
import { isTexlexSubsectionEmpty } from "../utils";

export function CollateralSummary({ content }: { content: string }) {
  if (isTexlexSubsectionEmpty(content)) return null;

  return (
    <View>
      <SectionHeading title="Collateral rating scales and reports" />
      <ProseParagraphs text={content} />
    </View>
  );
}
