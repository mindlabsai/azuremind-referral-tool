import { Text, View } from "@react-pdf/renderer";
import { TEXLEX_CRITERION_B_HEADER } from "../../constants/texlexBoilerplate";
import { SubsectionHeading } from "../components/SubsectionHeading";
import { styles } from "../styles";

export function SectionBHeading() {
  return (
    <View>
      <SubsectionHeading title={TEXLEX_CRITERION_B_HEADER.title} />
      <Text style={styles.domainDescription}>{TEXLEX_CRITERION_B_HEADER.description}</Text>
    </View>
  );
}
