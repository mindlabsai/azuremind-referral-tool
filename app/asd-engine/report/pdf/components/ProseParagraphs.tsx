import { Text, View } from "@react-pdf/renderer";
import { styles } from "../styles";
import { splitParagraphs } from "../utils";

type ProseParagraphsProps = {
  text: string;
  variant?: "body" | "boilerplate";
  emptyLabel?: string;
};

export function ProseParagraphs({
  text,
  variant = "body",
  emptyLabel = "—",
}: ProseParagraphsProps) {
  const paragraphs = splitParagraphs(text);
  const baseStyle = variant === "boilerplate" ? styles.boilerplate : styles.body;

  if (!paragraphs.length) {
    return <Text style={baseStyle}>{emptyLabel}</Text>;
  }

  return (
    <View>
      {paragraphs.map((paragraph, index) => (
        <Text key={`p-${index}`} style={index < paragraphs.length - 1 ? [baseStyle, { marginBottom: 8 }] : baseStyle}>
          {String(paragraph)}
        </Text>
      ))}
    </View>
  );
}
