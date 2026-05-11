import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function PresentingConcerns({ content }: { content: string }) {
  return (
    <View>
      <SectionHeading title="Presenting concerns" />
      <ProseParagraphs text={content} />
    </View>
  );
}
