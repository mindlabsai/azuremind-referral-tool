import { View } from "@react-pdf/renderer";
import { ProseParagraphs } from "../components/ProseParagraphs";
import { SectionHeading } from "../components/SectionHeading";
import { resolveFunctionalImpactDisplay } from "../utils";

export function FunctionalImpact({ content }: { content: string }) {
  return (
    <View>
      <SectionHeading title="Functional impact summary" />
      <ProseParagraphs text={resolveFunctionalImpactDisplay(content)} />
    </View>
  );
}
