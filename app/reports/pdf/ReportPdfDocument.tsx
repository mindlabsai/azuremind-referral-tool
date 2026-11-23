import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import { FieldStack } from "@/app/asd-engine/report/pdf/components/FieldStack";
import { HorizontalRule } from "@/app/asd-engine/report/pdf/components/HorizontalRule";
import { ProseParagraphs } from "@/app/asd-engine/report/pdf/components/ProseParagraphs";
import { SectionHeading } from "@/app/asd-engine/report/pdf/components/SectionHeading";
import { Footer } from "@/app/asd-engine/report/pdf/sections/Footer";
import { Signature } from "@/app/asd-engine/report/pdf/sections/Signature";
import { styles } from "@/app/asd-engine/report/pdf/styles";
import { TEXLEX_HEADER } from "@/app/asd-engine/report/constants/texlexBoilerplate";
import { sldCoverColumns, type SldCoverDetails } from "./cover-fields";

export type DeskReportSection = {
  title: string;
  body: string;
};

function CoverColumn({ lines, gap = false }: { lines: { label: string; value: string }[]; gap?: boolean }) {
  if (!lines.length) return null;
  return (
    <View style={[styles.identityColumn, gap ? { marginRight: 24 } : {}]}>
      {lines.map((line) => (
        <FieldStack key={line.label} label={line.label} value={line.value} />
      ))}
    </View>
  );
}

export function ReportPdfDocument({
  reportTitle,
  clientName,
  sections,
  logoSrc,
  signatureSrc,
  details,
}: {
  reportTitle: string;
  clientName: string;
  sections: DeskReportSection[];
  logoSrc: string;
  signatureSrc: string | null;
  details?: SldCoverDetails;
}) {
  const written = sections.filter((section) => section.body.trim());
  const cover = details ? sldCoverColumns(details) : null;
  const showCover = Boolean(cover && (cover.client.length || cover.assessor.length || cover.meta.length));
  const subtitle = details ? "" : clientName.trim() || "Client";
  return (
    <Document>
      <Page size="A4" wrap style={styles.page}>
        <Footer />
        <View style={styles.mastheadStrip}>
          <Image src={logoSrc} style={styles.logo} />
          <Text style={styles.confidentialMark}>{TEXLEX_HEADER.confidential}</Text>
        </View>
        <View style={styles.titleBlock}>
          <Text style={styles.documentTitle}>{reportTitle}</Text>
          {subtitle ? <Text style={styles.documentSubtitle}>{subtitle}</Text> : null}
        </View>
        {showCover && cover ? (
          <View>
            <HorizontalRule />
            <View style={styles.identityRow}>
              <CoverColumn lines={cover.client} gap={cover.assessor.length > 0} />
              <CoverColumn lines={cover.assessor} />
            </View>
            {cover.meta.length ? (
              <View>
                <HorizontalRule spacing={18} />
                <View style={styles.metadataStrip}>
                  {cover.meta.map((item) => (
                    <View key={item.label} style={[styles.metadataItem, { marginRight: 16, marginBottom: 8 }]}>
                      <Text style={styles.metadataLabel}>{item.label}</Text>
                      <Text style={styles.metadataValue}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
        {written.map((section) => (
          <View key={section.title}>
            <SectionHeading title={section.title} />
            <ProseParagraphs text={section.body} />
          </View>
        ))}
        <View wrap={false}>
          <Signature signatureSrc={signatureSrc} />
        </View>
      </Page>
    </Document>
  );
}
