import { Image, Text, View } from "@react-pdf/renderer";
import { TEXLEX_SIGNATURE } from "../../constants/texlexBoilerplate";
import { styles } from "../styles";

export function Signature({ signatureSrc }: { signatureSrc: string | null }) {
  return (
    <View wrap={false}>
      <View style={styles.signatureDivider} />
      <Text style={styles.signatureClosing}>{TEXLEX_SIGNATURE.closing}</Text>
      {signatureSrc ? (
        <Image src={signatureSrc} style={styles.signatureImage} />
      ) : (
        <Text style={styles.signaturePlaceholder}>{TEXLEX_SIGNATURE.signaturePlaceholder}</Text>
      )}
      <Text style={styles.signatureName}>{TEXLEX_SIGNATURE.name}</Text>
      <Text style={styles.signatureLine}>{TEXLEX_SIGNATURE.title}</Text>
      <Text style={styles.signatureLine}>{TEXLEX_SIGNATURE.registration}</Text>
      <Text style={styles.signaturePractice}>{TEXLEX_SIGNATURE.practice}</Text>
    </View>
  );
}
