/**
 * Texlex outbound communications — letters + multi-recipient email.
 * Sent via Texlex (Resend), not Cliniko.
 */

export type LetterKind =
  | "parent-cover"
  | "dr-muru-referral"
  | "referrer-update"
  | "custom";

export type LetterMergeFields = {
  clientName: string;
  clientFirstName: string;
  pronouns: string;
  dob: string;
  chronologicalAge: string;
  parent1: string;
  parent2: string;
  school: string;
  yearLevel: string;
  referringPractitioner: string;
  referringPractitionerType: string;
  assessor: string;
  reportDate: string;
  assessmentModality: string;
  diagnosticConclusionLabel: string;
  severityLine: string;
  practiceName: string;
  practicePhone: string;
};

export const LETTER_KIND_OPTIONS: Array<{ value: LetterKind; label: string; description: string }> = [
  {
    value: "parent-cover",
    label: "Parent cover letter",
    description: "Short cover when emailing the final report to parents.",
  },
  {
    value: "dr-muru-referral",
    label: "Referral — Dr Murugesh Nidyananda",
    description: "Consensus / medical review referral letter with report enclosed.",
  },
  {
    value: "referrer-update",
    label: "Update to referring practitioner",
    description: "Letter back to the referring GP / paediatrician.",
  },
  {
    value: "custom",
    label: "Custom letter",
    description: "Letterhead block only — you write the body.",
  },
];

function line(value: string): string {
  return value.trim() || "—";
}

function addresseeParents(fields: LetterMergeFields): string {
  const a = fields.parent1.trim();
  const b = fields.parent2.trim();
  if (a && b) return `${a} and ${b}`;
  if (a) return a;
  if (b) return b;
  return "Parent / guardian";
}

export function buildLetterSubject(kind: LetterKind, fields: LetterMergeFields): string {
  const name = line(fields.clientName);
  switch (kind) {
    case "parent-cover":
      return `Azure Mind — Assessment report for ${name}`;
    case "dr-muru-referral":
      return `Referral for consensus medical review — ${name}`;
    case "referrer-update":
      return `Neurodevelopmental assessment update — ${name}`;
    case "custom":
      return `Correspondence regarding ${name}`;
  }
}

export function buildLetterBody(kind: LetterKind, fields: LetterMergeFields): string {
  const name = line(fields.clientName);
  const first = line(fields.clientFirstName) || name;
  const parents = addresseeParents(fields);
  const referrer = line(fields.referringPractitioner);
  const referrerType = fields.referringPractitionerType.trim();
  const referrerLine = referrerType ? `${referrer} (${referrerType})` : referrer;
  const date = line(fields.reportDate);
  const assessor = line(fields.assessor);
  const conclusion = line(fields.diagnosticConclusionLabel);
  const severity = fields.severityLine.trim();
  const school = line(fields.school);
  const year = line(fields.yearLevel);
  const age = line(fields.chronologicalAge);
  const modality = fields.assessmentModality.trim() || "as documented";

  const header = [
    "Azure Mind",
    "Neurodevelopmental Assessment Pathway",
    `Date: ${date}`,
    "",
  ].join("\n");

  const signOff = [
    "",
    "Kind regards,",
    "",
    assessor,
    fields.practiceName.trim() || "Azure Mind",
    fields.practicePhone.trim() ? `Phone: ${fields.practicePhone.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (kind === "parent-cover") {
    return [
      header,
      `Dear ${parents},`,
      "",
      `Please find enclosed the completed neurodevelopmental assessment report for ${name} (DOB ${line(fields.dob)}; chronological age ${age}).`,
      "",
      `This assessment was conducted ${modality} as part of the Azure Mind consensus-based pathway. The report summarises clinical findings, functional impact, and recommendations to support ${first} at home and at school (${school}, Year ${year}).`,
      "",
      "Please keep this document confidential and share it only with those involved in care or educational planning, unless you are authorised or required by law to distribute it more widely.",
      "",
      "If you have questions about next steps in the pathway, you are welcome to contact the clinic.",
      signOff,
    ].join("\n");
  }

  if (kind === "dr-muru-referral") {
    return [
      header,
      "Dr Murugesh Nidyananda",
      "Child and Adolescent Psychiatrist",
      "Sage Clinic (Video Telehealth)",
      "",
      "Dear Dr Nidyananda,",
      "",
      `I am writing to refer ${name} (DOB ${line(fields.dob)}; chronological age ${age}) for consensus-based medical review within the Azure Mind neurodevelopmental pathway.`,
      "",
      `Assessment summary: ${conclusion}${severity ? ` ${severity}` : ""}`,
      "",
      `School: ${school} (Year ${year}). Assessment modality: ${modality}.`,
      referrer !== "—" ? `Referring practitioner: ${referrerLine}.` : "",
      "",
      "The enclosed report contains the full clinical formulation, DSM-5-TR criterion analysis, functional impact summary, and recommendations. I would be grateful for your review and ratification as clinically appropriate, including consideration of co-occurring concerns raised in the report.",
      "",
      "Please contact me if any additional information is required.",
      signOff,
    ]
      .filter((l) => l !== "")
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  if (kind === "referrer-update") {
    return [
      header,
      referrer !== "—" ? referrerLine : "Referring practitioner",
      "",
      `Dear ${referrer !== "—" ? referrer : "Colleague"},`,
      "",
      `Thank you for referring ${name} (DOB ${line(fields.dob)}; chronological age ${age}) for neurodevelopmental assessment.`,
      "",
      `Please find enclosed the completed assessment report. Summary of outcome: ${conclusion}${severity ? ` ${severity}` : ""}`,
      "",
      `School context: ${school}, Year ${year}.`,
      "",
      "Recommendations and next steps are detailed in the report. I remain available to discuss the findings if that would be helpful.",
      signOff,
    ].join("\n");
  }

  // custom
  return [
    header,
    "[Addressee]",
    "",
    "Dear …,",
    "",
    `[Letter body regarding ${name}]`,
    "",
    signOff,
  ].join("\n");
}

export function buildLetterEmailHtml(letterBody: string, clientName: string): string {
  const escaped = letterBody
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;font-size:15px;line-height:1.55;color:#1a1a1a;">
<p style="color:#666;font-size:12px;">Sent via Texlex · Azure Mind · Confidential — ${clientName.replace(/</g, "")}</p>
<div>${escaped}</div>
</body></html>`;
}

export function parseRecipientList(raw: string): string[] {
  const parts = raw
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const unique: string[] = [];
  for (const p of parts) {
    if (!emailRe.test(p)) continue;
    if (!unique.includes(p)) unique.push(p);
  }
  return unique;
}
