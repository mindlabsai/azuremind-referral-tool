import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function Limitations({ content }: { content: string }) {
  return (
    <View>
      <SectionHeading title="Limitations" />
      <ProseParagraphs text={content} variant="boilerplate" />
    </View>
  );
}
