/**
 * Texlex outbound communications — letters + multi-recipient email.
 * Body text is content-only; letterhead / signature come from Texlex PDF format.
 * Sent via Texlex (Resend), not Cliniko.
 */

export type LetterKind =
  | "parent-cover"
  | "dr-muru-referral"
  | "referrer-update"
  | "custom";

export type LetterPathway = "asd" | "adhd";

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
  /** Defaults to asd when omitted (ASD engine). */
  pathway?: LetterPathway;
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

/** Uppercase document title — matches Texlex report PDF masthead style. */
export function letterDocumentTitle(kind: LetterKind): string {
  switch (kind) {
    case "parent-cover":
      return "COVER LETTER";
    case "dr-muru-referral":
      return "REFERRAL LETTER";
    case "referrer-update":
      return "CLINICAL UPDATE LETTER";
    case "custom":
      return "CORRESPONDENCE";
  }
}

export function letterDocumentSubtitle(kind: LetterKind, pathway: LetterPathway = "asd"): string {
  const isAdhd = pathway === "adhd";
  switch (kind) {
    case "parent-cover":
      return isAdhd
        ? "Enclosing ADHD assessment report"
        : "Enclosing neurodevelopmental assessment report";
    case "dr-muru-referral":
      return isAdhd
        ? "Consensus-based medical review — ADHD pathway"
        : "Consensus-based medical review — Autism Spectrum Disorder pathway";
    case "referrer-update":
      return isAdhd
        ? "ADHD assessment outcome"
        : "Neurodevelopmental assessment outcome";
    case "custom":
      return isAdhd
        ? "Attention-Deficit/Hyperactivity Disorder Assessment Pathway"
        : "Neurodevelopmental Assessment Pathway";
  }
}

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

export function buildLetterRegardingLine(fields: LetterMergeFields): string {
  const name = line(fields.clientName);
  const dob = line(fields.dob);
  const age = line(fields.chronologicalAge);
  return `Re: ${name} · DOB ${dob} · Chronological age ${age}`;
}

export function buildLetterSubject(kind: LetterKind, fields: LetterMergeFields): string {
  const name = line(fields.clientName);
  const isAdhd = fields.pathway === "adhd";
  switch (kind) {
    case "parent-cover":
      return isAdhd
        ? `Azure Mind — ADHD assessment report for ${name}`
        : `Azure Mind — Assessment report for ${name}`;
    case "dr-muru-referral":
      return `Referral for consensus medical review — ${name}`;
    case "referrer-update":
      return isAdhd
        ? `ADHD assessment update — ${name}`
        : `Neurodevelopmental assessment update — ${name}`;
    case "custom":
      return `Correspondence regarding ${name}`;
  }
}

/**
 * Letter body only (salutation + paragraphs).
 * Texlex PDF supplies masthead, Re: line, and signature block.
 */
export function buildLetterBody(kind: LetterKind, fields: LetterMergeFields): string {
  const name = line(fields.clientName);
  const first = line(fields.clientFirstName) || name;
  const parents = addresseeParents(fields);
  const referrer = line(fields.referringPractitioner);
  const referrerType = fields.referringPractitionerType.trim();
  const referrerLine = referrerType ? `${referrer} (${referrerType})` : referrer;
  const conclusion = line(fields.diagnosticConclusionLabel);
  const severity = fields.severityLine.trim();
  const school = line(fields.school);
  const year = line(fields.yearLevel);
  const age = line(fields.chronologicalAge);
  const modality = fields.assessmentModality.trim() || "as documented";
  const isAdhd = fields.pathway === "adhd";
  const pathwayName = isAdhd
    ? "ADHD assessment pathway"
    : "Azure Mind consensus-based neurodevelopmental pathway";
  const conditionLabel = isAdhd ? "ADHD" : "neurodevelopmental";
  const reportNoun = isAdhd ? "ADHD assessment report" : "neurodevelopmental assessment report";

  if (kind === "parent-cover") {
    return [
      `Dear ${parents},`,
      "",
      `Please find enclosed the completed ${reportNoun} for ${name} (DOB ${line(fields.dob)}; chronological age ${age}).`,
      "",
      `This assessment was conducted ${modality} as part of the ${pathwayName}. The report summarises clinical findings, functional impact, and recommendations to support ${first} at home and at school (${school}, Year ${year}).`,
      "",
      "Please keep this document confidential and share it only with those involved in care or educational planning, unless you are authorised or required by law to distribute it more widely.",
      "",
      "If you have questions about next steps in the pathway, you are welcome to contact the clinic.",
    ].join("\n");
  }

  if (kind === "dr-muru-referral") {
    return [
      "Dr Murugesh Nidyananda",
      "Child and Adolescent Psychiatrist",
      "Sage Clinic (Video Telehealth)",
      "",
      "Dear Dr Nidyananda,",
      "",
      `I am writing to refer ${name} (DOB ${line(fields.dob)}; chronological age ${age}) for consensus-based medical review within the Azure Mind ${isAdhd ? "ADHD" : "neurodevelopmental"} pathway.`,
      "",
      `Assessment summary: ${conclusion}${severity ? ` ${severity}` : ""}`,
      "",
      `School: ${school} (Year ${year}). Assessment modality: ${modality}.`,
      referrer !== "—" ? `Referring practitioner: ${referrerLine}.` : "",
      "",
      isAdhd
        ? "The enclosed report contains the full clinical formulation, DSM-5-TR ADHD criterion analysis, functional impact summary, and recommendations. I would be grateful for your review and ratification as clinically appropriate, including consideration of co-occurring concerns raised in the report."
        : "The enclosed report contains the full clinical formulation, DSM-5-TR criterion analysis, functional impact summary, and recommendations. I would be grateful for your review and ratification as clinically appropriate, including consideration of co-occurring concerns raised in the report.",
      "",
      "Please contact me if any additional information is required.",
    ]
      .filter((l) => l !== "")
      .join("\n")
      .replace(/\n{3,}/g, "\n\n");
  }

  if (kind === "referrer-update") {
    return [
      referrer !== "—" ? referrerLine : "Referring practitioner",
      "",
      `Dear ${referrer !== "—" ? referrer : "Colleague"},`,
      "",
      `Thank you for referring ${name} (DOB ${line(fields.dob)}; chronological age ${age}) for ${conditionLabel} assessment.`,
      "",
      `Please find enclosed the completed assessment report. Summary of outcome: ${conclusion}${severity ? ` ${severity}` : ""}`,
      "",
      `School context: ${school}, Year ${year}.`,
      "",
      "Recommendations and next steps are detailed in the report. I remain available to discuss the findings if that would be helpful.",
    ].join("\n");
  }

  return [
    "[Addressee]",
    "",
    "Dear …,",
    "",
    `[Letter body regarding ${name}]`,
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Email HTML styled to match Texlex PDF correspondence (Helvetica, teal brand, CONFIDENTIAL). */
export function buildLetterEmailHtml(
  kind: LetterKind,
  letterBody: string,
  fields: LetterMergeFields
): string {
  const title = letterDocumentTitle(kind);
  const subtitle = letterDocumentSubtitle(kind, fields.pathway ?? "asd");
  const regarding = buildLetterRegardingLine(fields);
  const date = line(fields.reportDate);
  const bodyHtml = escapeHtml(letterBody).replace(/\n/g, "<br/>");
  const client = escapeHtml(fields.clientName || "Client");

  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f3f4f6;">
  <div style="max-width:640px;margin:24px auto;padding:32px 40px;background:#ffffff;border:1px solid #e5e7eb;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.55;">
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      <tr>
        <td style="font-size:13px;font-weight:700;color:#0e7c8a;letter-spacing:0.5px;">AZURE MIND</td>
        <td align="right" style="font-size:10px;font-weight:700;color:#6b7280;letter-spacing:2px;text-transform:uppercase;">CONFIDENTIAL</td>
      </tr>
    </table>
    <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#1a1a1a;margin-bottom:2px;">${escapeHtml(title)}</div>
    <div style="font-size:12px;font-style:italic;color:#6b7280;margin-bottom:14px;">${escapeHtml(subtitle)}</div>
    <div style="border-bottom:1px solid #e5e7eb;margin-bottom:14px;"></div>
    <div style="font-size:11px;color:#6b7280;margin-bottom:4px;">Date: ${escapeHtml(date)}</div>
    <div style="font-size:12px;font-weight:700;color:#1a1a1a;margin-bottom:16px;">${escapeHtml(regarding)}</div>
    <div style="font-size:14px;color:#1a1a1a;">${bodyHtml}</div>
    <div style="border-top:1px solid #e5e7eb;margin-top:24px;padding-top:16px;">
      <div style="margin-bottom:8px;">Kind Regards,</div>
      <div style="font-weight:700;">${escapeHtml(fields.assessor || "Vishal Maharaj")}</div>
      <div style="color:#6b7280;font-size:13px;">Registered Psychologist · PSY0001579010</div>
      <div style="color:#0e7c8a;font-size:13px;margin-top:2px;">${escapeHtml(fields.practiceName.trim() || "Azure Mind")}</div>
    </div>
    <div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;">
      Sent via Texlex · Azure Mind · Confidential — ${client}
    </div>
  </div>
</body>
</html>`;
}

export type SendAudience = "parents" | "clinician" | "parents-and-clinician";

export const SEND_AUDIENCE_OPTIONS: Array<{
  value: SendAudience;
  label: string;
  description: string;
  defaultLetterKind: LetterKind;
}> = [
  {
    value: "parents",
    label: "Parents",
    description: "Parent cover letter · report to carers",
    defaultLetterKind: "parent-cover",
  },
  {
    value: "clinician",
    label: "Clinician",
    description: "Update / referral letter · to referring practitioner or Dr Muru",
    defaultLetterKind: "referrer-update",
  },
  {
    value: "parents-and-clinician",
    label: "Parents + clinician",
    description: "Parent cover letter · parents on To, clinician on Cc",
    defaultLetterKind: "parent-cover",
  },
];

export type RecipientBuckets = {
  parentEmails: string[];
  clinicianEmails: string[];
};

/** Resolve To / Cc from audience + stored emails. */
export function resolveAudienceRecipients(
  audience: SendAudience,
  buckets: RecipientBuckets
): { to: string[]; cc: string[] } {
  const parents = buckets.parentEmails.filter(Boolean);
  const clinicians = buckets.clinicianEmails.filter(Boolean);
  if (audience === "parents") {
    return { to: parents, cc: [] };
  }
  if (audience === "clinician") {
    return { to: clinicians, cc: [] };
  }
  // parents-and-clinician: parents primary, clinician copied
  return { to: parents, cc: clinicians.filter((e) => !parents.includes(e)) };
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

