import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";

export function Formulation({
  content,
  title = "Clinical formulation and consensus opinion",
}: {
  content: string;
  title?: string;
}) {
  return (
    <View>
      <SectionHeading title={title} />
      <ProseParagraphs text={content} />
    </View>
  );
}
