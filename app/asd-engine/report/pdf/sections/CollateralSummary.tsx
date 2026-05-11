import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function CollateralSummary({ content }: { content: string }) {
  return (
    <View>
      <SectionHeading title="Collateral summary" />
      <ProseParagraphs text={content} />
    </View>
  );
}
