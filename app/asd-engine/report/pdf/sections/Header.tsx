import { Image, Text, View } from "@react-pdf/renderer";
import { TEXLEX_HEADER, TEXLEX_SIGNATURE } from "../../constants/texlexBoilerplate";
import { FieldStack } from "../components/FieldStack";
import { HorizontalRule } from "../components/HorizontalRule";
import { styles } from "../styles";
import type { TexlexPdfDraft } from "../types";
import {
  formatAssessmentDates,
  formatAustralianPhone,
  formatDetailValue,
  formatDobWithAge,
  formatIsoDate,
  formatParentsBlock,
  isSchoolAgeNotApplicable,
  resolveAssessorDisplayName,
  resolveMetadataField,
  sanitizeAddressField,
} from "../utils";

function MetadataStrip({
  referringPractitioner,
  school,
  yearLevel,
  pronouns,
}: {
  referringPractitioner: string | null;
  school: string | null;
  yearLevel: string | null;
  pronouns: string | null;
}) {
  const items = [
  referringPractitioner
    ? { label: "Referring practitioner", value: referringPractitioner }
    : null,
  school ? { label: "School", value: school } : null,
  yearLevel ? { label: "Year level", value: yearLevel } : null,
  pronouns ? { label: "Pronouns", value: pronouns } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (!items.length) return null;

  return (
    <View style={styles.metadataStrip}>
        {items.map((item) => (
          <View key={item.label} style={[styles.metadataItem, { marginRight: 16, marginBottom: 8 }]}>
          <Text style={styles.metadataLabel}>{item.label}</Text>
          <Text style={styles.metadataValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Header({ draft, logoSrc }: { draft: TexlexPdfDraft; logoSrc: string }) {
  const { patientDetails } = draft;
  const schoolNotApplicable = isSchoolAgeNotApplicable(patientDetails.dob);
  const clientName = formatDetailValue(patientDetails.clientName, "notProvided");
  const assessorName = resolveAssessorDisplayName(patientDetails.assessor, TEXLEX_SIGNATURE.name);
  const parents = formatParentsBlock(patientDetails.parent1, patientDetails.parent2);
  const address = sanitizeAddressField(patientDetails.address, patientDetails.phone);
  const phone = formatAustralianPhone(patientDetails.phone);
  const assessmentDate = formatAssessmentDates(patientDetails.assessmentDates, "notProvided");
  const reportDate = formatIsoDate(patientDetails.reportDate, "notProvided");
  const registrationLine = `${TEXLEX_SIGNATURE.title} · ${TEXLEX_SIGNATURE.registration}`;

  const referringPractitioner = resolveMetadataField(patientDetails.referringPractitioner, "notProvided");
  const school = resolveMetadataField(
    patientDetails.school,
    schoolNotApplicable && !patientDetails.school.trim() ? "na" : "notProvided"
  );
  const yearLevel = resolveMetadataField(
    patientDetails.yearLevel,
    schoolNotApplicable && !patientDetails.yearLevel.trim() ? "na" : "notProvided"
  );
  const pronouns = resolveMetadataField(patientDetails.pronouns, "notProvided");

  return (
    <View>
      <View style={styles.mastheadStrip}>
        <Image src={logoSrc} style={styles.logo} />
        <Text style={styles.confidentialMark}>{TEXLEX_HEADER.confidential}</Text>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.documentTitle}>{TEXLEX_HEADER.reportType}</Text>
        <Text style={styles.documentSubtitle}>{TEXLEX_HEADER.pathway}</Text>
      </View>

      <HorizontalRule />

      <View style={styles.identityRow}>
        <View style={[styles.identityColumn, { marginRight: 24 }]}>
          <Text style={styles.blockLabel}>Client</Text>
          <View style={styles.fieldStack}>
            <Text style={styles.fieldValue}>{clientName}</Text>
          </View>
          <FieldStack label="Date of birth" value={formatDobWithAge(patientDetails.dob)} />
          {parents ? <FieldStack label="Parents" value={parents} /> : null}
          {address !== "Not provided" ? <FieldStack label="Address" value={address} /> : null}
          {phone ? <FieldStack label="Phone" value={phone} /> : null}
        </View>

        <View style={styles.identityColumn}>
          <Text style={styles.blockLabel}>Assessor</Text>
          <View style={styles.fieldStack}>
            <Text style={styles.fieldValue}>{assessorName}</Text>
          </View>
          <FieldStack label="Registration" value={registrationLine} />
          <FieldStack label="Practice" value={TEXLEX_SIGNATURE.practice} />
          {assessmentDate !== "Not provided" ? (
            <FieldStack label="Date of assessment" value={assessmentDate} />
          ) : null}
          {reportDate !== "Not provided" ? (
            <FieldStack label="Date of report" value={reportDate} />
          ) : null}
        </View>
      </View>

      <HorizontalRule spacing={18} />

      <MetadataStrip
        referringPractitioner={referringPractitioner}
        school={school}
        yearLevel={yearLevel}
        pronouns={pronouns}
      />
    </View>
  );
}
