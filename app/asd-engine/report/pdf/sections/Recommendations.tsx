import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function Recommendations({ content }: { content: string }) {
  return (
    <View>
      <SectionHeading title="Recommendations" />
      <ProseParagraphs text={content} />
    </View>
  );
}
