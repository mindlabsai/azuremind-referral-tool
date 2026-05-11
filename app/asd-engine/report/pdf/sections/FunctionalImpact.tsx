import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function FunctionalImpact({ content }: { content: string }) {
  return (
    <View>
      <SectionHeading title="Functional impact summary" />
      <ProseParagraphs text={content} />
    </View>
  );
}
