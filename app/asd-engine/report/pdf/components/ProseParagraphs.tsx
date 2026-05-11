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
        <Text
          key={`${index}-${paragraph.slice(0, 12)}`}
          style={[baseStyle, index < paragraphs.length - 1 ? { marginBottom: 8 } : {}]}
        >
          {paragraph}
        </Text>
      ))}
    </View>
  );
}
