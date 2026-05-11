import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function Formulation({ content }: { content: string }) {
  return (
    <View>
      <SectionHeading title="Clinical formulation and consensus opinion" />
      <ProseParagraphs text={content} />
    </View>
  );
}
