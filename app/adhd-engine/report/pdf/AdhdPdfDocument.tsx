import { Document, Page, Text, View } from "@react-pdf/renderer";
import { ProseParagraphs } from "@/app/asd-engine/report/pdf/components/ProseParagraphs";
import { SectionHeading } from "@/app/asd-engine/report/pdf/components/SectionHeading";
import { CollateralSummary } from "@/app/asd-engine/report/pdf/sections/CollateralSummary";
import { Footer } from "@/app/asd-engine/report/pdf/sections/Footer";
import { Formulation } from "@/app/asd-engine/report/pdf/sections/Formulation";
import { Limitations } from "@/app/asd-engine/report/pdf/sections/Limitations";
import { PresentingConcerns } from "@/app/asd-engine/report/pdf/sections/PresentingConcerns";
import { Recommendations } from "@/app/asd-engine/report/pdf/sections/Recommendations";
import { Signature } from "@/app/asd-engine/report/pdf/sections/Signature";
import { styles } from "@/app/asd-engine/report/pdf/styles";
import { isTexlexSubsectionEmpty } from "@/app/asd-engine/report/pdf/utils";
import { AdhdBackground } from "./AdhdBackground";
import { AdhdHeader } from "./AdhdHeader";
import type { AdhdPdfDraft } from "./types";

export type AdhdPdfDocumentProps = {
  draft: AdhdPdfDraft;
  logoSrc: string;
  signatureSrc: string | null;
};

function assessmentContextText(draft: AdhdPdfDraft): string {
  const modalityLine =
    draft.assessmentModality === "in-clinic"
      ? "This assessment was conducted in-clinic.\n\n"
      : draft.assessmentModality === "virtual"
        ? "This assessment was conducted via secure video (telehealth).\n\n"
        : "";

  return (
    modalityLine +
    "This assessment was conducted as part of a consensus-based neurodevelopmental assessment pathway to explore the presence of Attention-Deficit/Hyperactivity Disorder (ADHD) and associated developmental, behavioural, attentional, and/or functional concerns.\n\n" +
    "The assessment process included clinical interview, behavioural observations obtained during assessment, developmental history review, and consideration of available collateral information and supporting documentation where applicable.\n\n" +
    "Findings are preliminary within the consensus pathway and warrant ratification by a developmental paediatrician or child psychiatrist as clinically appropriate."
  );
}

function hasBackgroundContent(background: AdhdPdfDraft["background"]): boolean {
  return (
    !isTexlexSubsectionEmpty(background.pregnancyBirth) ||
    !isTexlexSubsectionEmpty(background.earlyDevelopment) ||
    !isTexlexSubsectionEmpty(background.educationalHistory) ||
    !isTexlexSubsectionEmpty(background.emotionalBehaviouralSensory)
  );
}

export function AdhdPdfDocument({ draft, logoSrc, signatureSrc }: AdhdPdfDocumentProps) {
  const showPresenting = !isTexlexSubsectionEmpty(draft.presentingConcerns);
  const showBackground = hasBackgroundContent(draft.background);
  const showCollateral = !isTexlexSubsectionEmpty(draft.collateralSummary);
  const showFormulation = !isTexlexSubsectionEmpty(draft.formulation);
  const showRecommendations = !isTexlexSubsectionEmpty(draft.recommendations);
  const showLimitations = !isTexlexSubsectionEmpty(draft.limitationsText);

  return (
    <Document>
      <Page size="A4" wrap={false} style={styles.page}>
        <AdhdHeader draft={draft} logoSrc={logoSrc} />
        <View>
          <SectionHeading title="Assessment context" />
          <ProseParagraphs text={assessmentContextText(draft)} variant="boilerplate" />
        </View>
      </Page>
      <Page size="A4" wrap style={styles.page}>
        <Footer />
        {showPresenting ? <PresentingConcerns content={draft.presentingConcerns} /> : null}
        {showBackground ? <AdhdBackground background={draft.background} /> : null}
        {showCollateral ? <CollateralSummary content={draft.collateralSummary} /> : null}
        {showFormulation ? (
          <Formulation content={draft.formulation} title="Clinical formulation" />
        ) : null}
        {showRecommendations ? <Recommendations content={draft.recommendations} /> : null}
        {showLimitations ? <Limitations content={draft.limitationsText} /> : null}
        <Signature signatureSrc={signatureSrc} />
        {!showPresenting &&
        !showBackground &&
        !showCollateral &&
        !showFormulation &&
        !showRecommendations ? (
          <Text style={styles.body}>No section content has been generated yet.</Text>
        ) : null}
      </Page>
    </Document>
  );
}
