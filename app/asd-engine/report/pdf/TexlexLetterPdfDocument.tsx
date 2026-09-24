import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import {
  buildLetterRegardingLine,
  letterDocumentSubtitle,
  letterDocumentTitle,
  type LetterKind,
  type LetterMergeFields,
} from "@/lib/texlex-comms/letters";
import { TEXLEX_HEADER, TEXLEX_SIGNATURE } from "../constants/texlexBoilerplate";
import { HorizontalRule } from "./components/HorizontalRule";
import { ProseParagraphs } from "./components/ProseParagraphs";
import { Footer } from "./sections/Footer";
import { Signature } from "./sections/Signature";
import { styles } from "./styles";
import { formatIsoDate } from "./utils";

export type TexlexLetterPdfDocumentProps = {
  kind: LetterKind;
  body: string;
  fields: LetterMergeFields;
  logoSrc: string;
  signatureSrc: string | null;
};

export function TexlexLetterPdfDocument({
  kind,
  body,
  fields,
  logoSrc,
  signatureSrc,
}: TexlexLetterPdfDocumentProps) {
  const title = letterDocumentTitle(kind);
  const subtitle = letterDocumentSubtitle(kind, fields.pathway ?? "asd");
  const regarding = buildLetterRegardingLine(fields);
  const reportDate = formatIsoDate(fields.reportDate, "notProvided");

  return (
    <Document>
      <Page size="A4" wrap style={styles.page}>
        <Footer />

        <View style={styles.mastheadStrip}>
          <Image src={logoSrc} style={styles.logo} />
          <Text style={styles.confidentialMark}>{TEXLEX_HEADER.confidential}</Text>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.documentTitle}>{title}</Text>
          <Text style={styles.documentSubtitle}>{subtitle}</Text>
        </View>

        <HorizontalRule />

        <View style={{ marginTop: 14, marginBottom: 6 }}>
          <Text style={styles.fieldLabel}>Date</Text>
          <Text style={styles.fieldValue}>{reportDate}</Text>
        </View>
        <View style={{ marginBottom: 14 }}>
          <Text style={[styles.fieldValue, { fontFamily: "Helvetica-Bold" }]}>{regarding}</Text>
          {fields.school.trim() ? (
            <Text style={[styles.fieldLabel, { marginTop: 6 }]}>
              School · {fields.school.trim()}
              {fields.yearLevel.trim() ? ` · Year ${fields.yearLevel.trim()}` : ""}
            </Text>
          ) : null}
        </View>

        <HorizontalRule spacing={18} />

        <View style={{ marginTop: 14 }}>
          <ProseParagraphs text={body} />
        </View>

        <View wrap={false}>
          <Signature signatureSrc={signatureSrc} />
          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
            Prepared with Texlex · {TEXLEX_SIGNATURE.practice}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
