/**
 * Parent booking invitation emails — Azure Mind referral engine.
 * Mobile-first, teal brand, clickable fees → Cliniko bookings.
 * Pathways: ADHD / ASD / SLD assessments only (no consult routing).
 */

export type ParentBookingPathway = "ADHD" | "ASD" | "SLD";

export type ParentBookingFields = {
  childFirst: string;
  parentFirst: string;
  /** Referring doctor, shown in the parent letter as Dr Name. Email is never included. */
  referrerName?: string;
  assessmentType: ParentBookingPathway;
  bookingLink: string;
  clinicPhone: string;
};

export type FeeOption = {
  label: string;
  detail: string;
  duration: string;
  feeDisplay: string;
  /** Optional Cliniko deep-link fragment; falls back to shared booking URL */
  href?: string;
};

const BRAND = {
  teal: "#0E9F98",
  tealDeep: "#075E63",
  tealDark: "#0A474A",
  tealSoft: "#E8F6F5",
  tealBorder: "#B7E1DE",
  ink: "#1A3335",
  muted: "#5A7274",
  paper: "#FFFFFF",
  wash: "#F3F8F8",
  cta: "#0E9F98",
} as const;

export const DEFAULT_CLINIKO_BOOKINGS =
  "https://azurepsychology-cockburn.au1.cliniko.com/bookings#service";

export const CLINIC_ADDRESS_LINE = "Connections WA, 551 Marmion Street, Booragoon WA 6154";

const FEES: Record<ParentBookingPathway, FeeOption[]> = {
  ADHD: [
    {
      label: "ADHD Assessment Clinic",
      detail: "In person",
      duration: "60 minutes",
      feeDisplay: "$1,150",
    },
    {
      label: "ADHD Video Telehealth",
      detail: "Online",
      duration: "60 minutes",
      feeDisplay: "$650",
    },
  ],
  ASD: [
    {
      label: "ASD Assessment Clinic",
      detail: "In person",
      duration: "90 minutes",
      feeDisplay: "$2,000",
    },
    {
      label: "Autism Assessment Video Telehealth",
      detail: "Online",
      duration: "90 minutes",
      feeDisplay: "$1,850",
    },
  ],
  SLD: [
    {
      label: "SLD Ass",
      detail: "Specific Learning Disorder assessment",
      duration: "120 minutes",
      feeDisplay: "$2,200",
    },
    {
      label: "SLD Assess ADHD",
      detail: "Learning + ADHD combined",
      duration: "120 minutes",
      feeDisplay: "$2,500",
    },
  ],
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function capitaliseWords(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word
    )
    .join(" ");
}

function parentGreeting(parentFirst: string): string {
  const name = capitaliseWords(parentFirst);
  return name ? `Hello ${escapeHtml(name)},` : "Hello,";
}

function childBits(childFirst: string): { name: string; possessive: string; meet: string } {
  const raw = capitaliseWords(childFirst);
  if (!raw) return { name: "your child", possessive: "your child's", meet: "your child" };
  const name = escapeHtml(raw);
  return { name, possessive: `${name}'s`, meet: name };
}

/** Parent-facing doctor title. Practice emails never belong here. */
function referringDoctor(raw: string | undefined): string {
  let name = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!name || name.includes("@")) return "";
  name = name.replace(/^(dr|doctor)\.?\s+/i, "");
  name = capitaliseWords(name);
  if (!name) return "";
  return `Dr ${name}`;
}

function normalizeBookingHref(raw: string): string {
  const trimmed = raw.trim() || DEFAULT_CLINIKO_BOOKINGS;
  if (trimmed.includes("#")) return trimmed;
  return `${trimmed.replace(/\/$/, "")}#service`;
}

function pathwayCopy(
  pathway: ParentBookingPathway,
  child: { name: string; possessive: string; meet: string },
  doctor: string
): {
  subject: string;
  eyebrow: string;
  strap: string;
  paragraphs: string[];
  selectHint: string;
} {
  const fromDoctor = doctor
    ? ` from <strong style="white-space:nowrap;">${escapeHtml(doctor)}</strong>`
    : "";
  const opening = `We're getting in touch following ${child.possessive} referral${fromDoctor}, which has been shared with Azure Mind through Perth Paediatrics.`;
  const assessment = `The first stage involves a comprehensive psychological assessment with <strong>Vishal Maharaj, Registered Psychologist</strong>, to better understand ${child.possessive} development, strengths, challenges and individual needs.`;
  const assist = `Our team will be happy to help you arrange ${child.possessive} initial appointment and to answer any questions you may have about the process.`;
  const closing = `We look forward to meeting you and ${child.meet}.`;

  if (pathway === "ADHD") {
    return {
      subject: `${child.name === "your child" ? "Your child's" : child.possessive} referral — ADHD assessment`,
      eyebrow: "ADHD assessment",
      strap: "Psychologist, Paediatrician and Child Psychiatrist pathway",
      paragraphs: [
        opening,
        "At Azure Mind, we work closely with a network of Paediatricians and Child Psychiatrists through a collaborative ADHD assessment pathway, helping families access coordinated assessment and care.",
        assessment,
        "Following the assessment, Vishal Maharaj, Registered Psychologist, will prepare a detailed report outlining the findings and recommendations. Where the findings support a preliminary diagnosis of ADHD, we can then arrange a referral to one of our partner Paediatricians or Child Psychiatrists for further medical assessment and diagnostic review.",
        assist,
        closing,
      ],
      selectHint: "Select <strong>ADHD</strong>, then your preferred appointment.",
    };
  }
  if (pathway === "ASD") {
    return {
      subject: `${child.name === "your child" ? "Your child's" : child.possessive} referral — Autism assessment`,
      eyebrow: "Autism assessment",
      strap: "Psychologist, Paediatrician and Child Psychiatrist pathway",
      paragraphs: [
        opening,
        "At Azure Mind, we work closely with a network of Paediatricians and Child Psychiatrists through a collaborative Autism assessment pathway, helping families access coordinated assessment and care.",
        assessment,
        "Following the assessment, Vishal Maharaj, Registered Psychologist, will prepare a detailed report outlining the findings and recommendations. Where the findings support a diagnosis of Autism, we can then arrange a referral to one of our partner Paediatricians or Child Psychiatrists for further medical assessment and diagnostic review.",
        assist,
        closing,
      ],
      selectHint: "Select <strong>Autism</strong>, then your preferred appointment.",
    };
  }
  return {
    subject: `${child.name === "your child" ? "Your child's" : child.possessive} referral — learning assessment`,
    eyebrow: "Specific Learning Disorder assessment",
    strap: "Registered Psychologist assessment",
    paragraphs: [
      opening,
      "At Azure Mind, the Specific Learning Disorder assessment looks carefully at reading, written expression and mathematics, so the report can guide support at school and at home.",
      `The assessment is completed with <strong>Vishal Maharaj, Registered Psychologist</strong>, to better understand ${child.possessive} learning, development, strengths and individual needs.`,
      "Following the assessment, Vishal Maharaj, Registered Psychologist, will prepare a detailed report outlining the findings and recommendations. Where a medical review would assist, we can arrange a referral to one of our partner Paediatricians.",
      assist,
      closing,
    ],
    selectHint: "Select <strong>Learning Assessment</strong>, then your preferred appointment.",
  };
}

function feeCardsHtml(fees: FeeOption[], bookingHref: string): string {
  return fees
    .map((fee, i) => {
      const feeHref = escapeHtml(fee.href || bookingHref);
      const topPad = i === 0 ? "0" : "10px";
      return (
        `<tr><td style="padding:${topPad} 0 0;">` +
        `<a href="${feeHref}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:block;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${BRAND.tealBorder};border-radius:14px;background:${BRAND.paper};">` +
        `<tr>` +
        `<td style="padding:16px 18px;vertical-align:middle;">` +
        `<div style="font-size:15px;font-weight:700;color:${BRAND.tealDeep};letter-spacing:-0.2px;line-height:1.3;">${escapeHtml(fee.label)}</div>` +
        `<div style="font-size:13px;color:${BRAND.muted};margin-top:4px;line-height:1.4;">${escapeHtml(fee.detail)} · ${escapeHtml(fee.duration)}</div>` +
        `</td>` +
        `<td style="padding:16px 18px;vertical-align:middle;text-align:right;white-space:nowrap;width:1%;">` +
        `<div style="font-size:20px;font-weight:800;color:${BRAND.teal};letter-spacing:-0.4px;">${escapeHtml(fee.feeDisplay)}</div>` +
        `<div style="font-size:11px;font-weight:600;color:${BRAND.tealDeep};margin-top:2px;text-transform:uppercase;letter-spacing:0.04em;">Book →</div>` +
        `</td>` +
        `</tr></table></a></td></tr>`
      );
    })
    .join("");
}

/** Full HTML email for Resend / Gmail. */
export function buildParentBookingEmailHtml(fields: ParentBookingFields): string {
  const bookingHref = normalizeBookingHref(fields.bookingLink);
  const child = childBits(fields.childFirst);
  const doctor = referringDoctor(fields.referrerName);
  const copy = pathwayCopy(fields.assessmentType, child, doctor);
  const fees = FEES[fields.assessmentType];
  const phone = escapeHtml(fields.clinicPhone.trim() || "0422 182 967");
  const letter = copy.paragraphs
    .map(
      (paragraph, index) =>
        `<p style="margin:0 0 ${index === copy.paragraphs.length - 1 ? "18" : "12"}px;font-size:15px;line-height:1.6;color:${BRAND.ink};">${paragraph}</p>`
    )
    .join("");
  const preheader = escapeHtml(
    (copy.paragraphs[0] ?? "")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, " ")
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.wash};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.ink};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.wash};">${preheader}${"&nbsp;&zwnj;".repeat(12)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.wash};padding:20px 12px 36px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

<!-- Brand bar -->
<tr><td style="background:linear-gradient(135deg,${BRAND.tealDeep} 0%,${BRAND.teal} 100%);border-radius:16px 16px 0 0;padding:22px 24px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="font-family:inherit;font-size:13px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.78);">Azure Mind</div>
  <div style="font-family:inherit;font-size:28px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#fff;margin-top:8px;line-height:1.2;">${escapeHtml(copy.eyebrow)}</div>
  <div style="font-family:inherit;font-size:15px;font-weight:500;color:rgba(255,255,255,0.82);margin-top:8px;line-height:1.4;">${escapeHtml(copy.strap)}</div>
</td></tr>

<!-- Body -->
<tr><td style="background:${BRAND.paper};padding:26px 24px 8px;border-left:1px solid ${BRAND.tealBorder};border-right:1px solid ${BRAND.tealBorder};">
  <p style="margin:0 0 14px;font-size:16px;font-weight:600;color:${BRAND.tealDeep};">${parentGreeting(fields.parentFirst)}</p>
  ${letter}

  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.tealDeep};margin:0 0 10px;">Choose an appointment</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${feeCardsHtml(fees, bookingHref)}
  </table>

  <!-- Primary CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
    <tr><td align="center">
      <a href="${escapeHtml(bookingHref)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;background:${BRAND.cta};color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:16px 28px;border-radius:12px;letter-spacing:-0.2px;box-shadow:0 8px 20px rgba(14,159,152,0.28);">
        Book online now
      </a>
    </td></tr>
  </table>
  <p style="margin:0 0 20px;text-align:center;font-size:13px;line-height:1.45;color:${BRAND.muted};">${copy.selectHint}</p>

  <!-- Help strip -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    <tr><td align="center" style="background:${BRAND.tealSoft};border:1px solid ${BRAND.tealBorder};border-radius:12px;padding:18px 20px;text-align:center;">
      <div style="font-size:16px;font-weight:700;color:${BRAND.tealDeep};">Need help booking?</div>
      <div style="font-size:15px;color:${BRAND.ink};margin-top:6px;line-height:1.5;">
        Reply <strong style="color:${BRAND.tealDeep};">BOOK</strong>, and the Azure Mind Team will arrange the appointment for you.
      </div>
    </td></tr>
  </table>

  <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${BRAND.muted};">
    Our clinic is located within <strong style="color:${BRAND.ink};">Connections WA, 551 Marmion Street, Booragoon WA 6154</strong>. Please check in at reception when you arrive.
  </p>
  <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${BRAND.muted};">
    If you already have an appointment booked with your Paediatrician, please keep that appointment. Paediatric consultations are arranged and billed separately.
  </p>
</td></tr>

<!-- Signature -->
<tr><td style="background:${BRAND.paper};padding:4px 24px 24px;border-left:1px solid ${BRAND.tealBorder};border-right:1px solid ${BRAND.tealBorder};">
  <div style="height:1px;background:${BRAND.tealBorder};margin:0 0 18px;"></div>
  <p style="margin:0;font-size:14px;color:${BRAND.ink};line-height:1.5;">Warm regards,</p>
  <p style="margin:10px 0 0;font-size:16px;font-weight:800;color:${BRAND.tealDeep};letter-spacing:-0.2px;">Azure Mind Team</p>
  <p style="margin:10px 0 0;font-size:13px;line-height:1.55;color:${BRAND.muted};">
    <a href="tel:${phone.replace(/\s/g, "")}" style="color:${BRAND.tealDeep};text-decoration:none;font-weight:600;">${phone}</a>
    · <a href="mailto:admin@azuremind.com.au" style="color:${BRAND.tealDeep};text-decoration:none;font-weight:600;">admin@azuremind.com.au</a><br>
    Monday–Friday, 9:30&nbsp;am–3&nbsp;pm
  </p>
</td></tr>

<!-- Footer -->
<tr><td style="background:${BRAND.tealDark};border-radius:0 0 16px 16px;padding:16px 24px;">
  <p style="margin:0;font-size:11px;line-height:1.55;color:rgba(255,255,255,0.65);">
    Azure Mind Psychology · Perth, Western Australia<br>
    Fees shown are listed appointment fees for the psychology stage and may not be the total pathway cost.
  </p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export function getParentBookingSubject(fields: ParentBookingFields): string {
  const child = childBits(fields.childFirst);
  return pathwayCopy(fields.assessmentType, child, referringDoctor(fields.referrerName)).subject;
}

export function getParentBookingSms(fields: ParentBookingFields): string {
  const childName = capitaliseWords(fields.childFirst);
  const possessive = childName ? `${childName}'s` : "your child's";
  const parent = capitaliseWords(fields.parentFirst);
  const hello = parent ? `Hello ${parent}` : "Hello";
  const doctor = referringDoctor(fields.referrerName);
  const fromDoctor = doctor ? ` from ${doctor}` : "";
  const booking = normalizeBookingHref(fields.bookingLink);
  const phone = fields.clinicPhone.trim() || "0422 182 967";
  const label =
    fields.assessmentType === "ADHD"
      ? "an ADHD assessment"
      : fields.assessmentType === "ASD"
        ? "an Autism assessment"
        : "a Specific Learning Disorder assessment";
  return `${hello},\n\nWe're getting in touch following ${possessive} referral${fromDoctor}, shared with Azure Mind through Perth Paediatrics, for ${label} with Vishal Maharaj, Registered Psychologist.\n\nBook online:\n${booking}\n\nThe Azure Mind Team can help. Reply BOOK or call/text ${phone}.`;
}

export function feeOptionsForPathway(pathway: ParentBookingPathway): FeeOption[] {
  return FEES[pathway];
}
