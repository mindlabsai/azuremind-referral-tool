import { Text, View } from "@react-pdf/renderer";
import { TEXLEX_CRITERION_C_HEADER } from "../../constants/texlexBoilerplate";
import { SubsectionHeading } from "../components/SubsectionHeading";
import { styles } from "../styles";

export function SectionCHeading() {
  return (
    <View>
      <SubsectionHeading title={TEXLEX_CRITERION_C_HEADER.title} />
      <Text style={styles.domainDescription}>{TEXLEX_CRITERION_C_HEADER.description}</Text>
    </View>
  );
}
