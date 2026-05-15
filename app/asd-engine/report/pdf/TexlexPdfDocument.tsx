import { Document, Page } from "@react-pdf/renderer";
/* PDF uses built-in Helvetica (see styles.ts). Do not load remote Inter here — fontkit metrics
   can corrupt and yield coordinates outside pdfkit's ±1e21 range, causing "unsupported number". */
export { BRAND, BRAND_LIGHT, INK, MUTED, RULE, SUBTLE } from "./tokens";
import { AssessmentContext } from "./sections/AssessmentContext";
import { Background } from "./sections/Background";
import { CollateralSummary } from "./sections/CollateralSummary";
import { CriterionBlock } from "./sections/CriterionBlock";
import { DSMIntro } from "./sections/DSMIntro";
import { Footer } from "./sections/Footer";
import { Formulation } from "./sections/Formulation";
import { FunctionalImpact } from "./sections/FunctionalImpact";
import { Header } from "./sections/Header";
import { Limitations } from "./sections/Limitations";
import { PresentingConcerns } from "./sections/PresentingConcerns";
import { Recommendations } from "./sections/Recommendations";
import { SectionBHeading } from "./sections/SectionBHeading";
import { Signature } from "./sections/Signature";
import { styles } from "./styles";
import type { TexlexPdfDraft } from "./types";

export type TexlexPdfDocumentProps = {
  draft: TexlexPdfDraft;
  logoSrc: string;
  signatureSrc: string | null;
};

export function TexlexPdfDocument({ draft, logoSrc, signatureSrc }: TexlexPdfDocumentProps) {
  return (
    <Document>
      {/* Cover (no footer): identity + assessment context + consent. Body starts at Presenting Concerns. */}
      <Page size="A4" wrap={false} style={styles.page}>
        <Header draft={draft} logoSrc={logoSrc} />
        <AssessmentContext />
      </Page>
      <Page size="A4" wrap style={styles.page}>
        <Footer />
        <PresentingConcerns content={draft.presentingConcerns} />
        <Background background={draft.background} />
        <CollateralSummary content={draft.collateralSummary} />
        <DSMIntro />
        <CriterionBlock code="A1" criterion={draft.criteria.A1} />
        <CriterionBlock code="A2" criterion={draft.criteria.A2} />
        <CriterionBlock code="A3" criterion={draft.criteria.A3} />
        <SectionBHeading />
        <CriterionBlock code="B1" criterion={draft.criteria.B1} />
        <CriterionBlock code="B2" criterion={draft.criteria.B2} />
        <CriterionBlock code="B3" criterion={draft.criteria.B3} />
        <CriterionBlock code="B4" criterion={draft.criteria.B4} />
        <FunctionalImpact content={draft.functionalImpactSummary} />
        <Formulation content={draft.clinicalFormulation} />
        <Recommendations content={draft.recommendations} />
        <Limitations content={draft.limitationsText} />
        <Signature signatureSrc={signatureSrc} />
      </Page>
    </Document>
  );
}
