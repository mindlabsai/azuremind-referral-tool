/**
 * Parent booking invitation emails — Azure Mind referral engine.
 * Mobile-first, teal brand, clickable fees → Cliniko bookings.
 * Pathways: ADHD / ASD / SLD assessments only (no consult routing).
 */

export type ParentBookingPathway = "ADHD" | "ASD" | "SLD";

export type ParentBookingFields = {
  childFirst: string;
  parentFirst: string;
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

export const CLINIC_ADDRESS_LINE = "Inside Connections WA · 551 Marmion Street, Booragoon WA 6154";

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

function parentGreeting(parentFirst: string): string {
  const name = parentFirst.trim();
  return name ? `Hi ${escapeHtml(name)},` : "Hi,";
}

function childLabel(childFirst: string): string {
  const name = childFirst.trim();
  return name ? escapeHtml(name) : "your child";
}

function normalizeBookingHref(raw: string): string {
  const trimmed = raw.trim() || DEFAULT_CLINIKO_BOOKINGS;
  if (trimmed.includes("#")) return trimmed;
  return `${trimmed.replace(/\/$/, "")}#service`;
}

function pathwayCopy(pathway: ParentBookingPathway, child: string): {
  subject: string;
  eyebrow: string;
  lead: string;
  next: string;
  selectHint: string;
} {
  if (pathway === "ADHD") {
    return {
      subject: "Your Perth Paediatrics referral — next appointment",
      eyebrow: "ADHD assessment",
      lead: `Perth Paediatrics has shared ${child}'s referral with Azure Mind to arrange the psychology stage of their ADHD assessment.`,
      next: "Your appointment is with Vishal Maharaj, Registered Psychologist. The findings will be shared with your paediatrician to support their review.",
      selectHint: "Select <strong>ADHD</strong>, then your preferred appointment.",
    };
  }
  if (pathway === "ASD") {
    return {
      subject: "Your Perth Paediatrics referral — next appointment",
      eyebrow: "Autism assessment",
      lead: `Perth Paediatrics has shared ${child}'s referral with Azure Mind to arrange the psychology stage of their autism assessment.`,
      next: "Your appointment is with Vishal Maharaj, Registered Psychologist. The findings will be shared with your paediatrician to support their review.",
      selectHint: "Select <strong>AUTISM</strong>, then your preferred appointment.",
    };
  }
  return {
    subject: "Your Perth Paediatrics referral — learning assessment",
    eyebrow: "Learning assessment",
    lead: `Perth Paediatrics has shared ${child}'s referral with Azure Mind to arrange the psychology stage of their learning assessment.`,
    next: "Your appointment is with Vishal Maharaj, Registered Psychologist. The findings will help guide school support and inform your paediatrician's review.",
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
  const child = childLabel(fields.childFirst);
  const copy = pathwayCopy(fields.assessmentType, child);
  const fees = FEES[fields.assessmentType];
  const phone = escapeHtml(fields.clinicPhone.trim() || "0422 182 967");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.wash};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${BRAND.ink};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.wash};padding:20px 12px 36px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

<!-- Brand bar -->
<tr><td style="background:linear-gradient(135deg,${BRAND.tealDeep} 0%,${BRAND.teal} 100%);border-radius:16px 16px 0 0;padding:22px 24px 18px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.72);">Azure Mind</div>
  <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.4px;margin-top:6px;line-height:1.2;">${escapeHtml(copy.eyebrow)}</div>
  <div style="font-size:13px;color:rgba(255,255,255,0.78);margin-top:6px;">Shared Psychologist–Paediatrician pathway</div>
</td></tr>

<!-- Body -->
<tr><td style="background:${BRAND.paper};padding:26px 24px 8px;border-left:1px solid ${BRAND.tealBorder};border-right:1px solid ${BRAND.tealBorder};">
  <p style="margin:0 0 14px;font-size:16px;font-weight:600;color:${BRAND.tealDeep};">${parentGreeting(fields.parentFirst)}</p>
  <p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${BRAND.ink};">${copy.lead}</p>
  <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:${BRAND.ink};">${copy.next}</p>

  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.tealDeep};margin:0 0 10px;">Choose an appointment</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${feeCardsHtml(fees, bookingHref)}
  </table>

  <!-- Primary CTA -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">
    <tr><td align="center">
      <a href="${escapeHtml(bookingHref)}" target="_blank" rel="noopener noreferrer"
        style="display:inline-block;background:${BRAND.cta};color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:16px 28px;border-radius:12px;letter-spacing:-0.2px;box-shadow:0 8px 20px rgba(14,159,152,0.28);">
        View times &amp; book
      </a>
    </td></tr>
  </table>
  <p style="margin:0 0 20px;text-align:center;font-size:13px;line-height:1.45;color:${BRAND.muted};">${copy.selectHint}</p>

  <!-- Help strip -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
    <tr><td style="background:${BRAND.tealSoft};border:1px solid ${BRAND.tealBorder};border-radius:12px;padding:14px 16px;">
      <div style="font-size:14px;font-weight:700;color:${BRAND.tealDeep};">Need help booking?</div>
      <div style="font-size:14px;color:${BRAND.ink};margin-top:4px;line-height:1.45;">
        Reply <strong style="color:${BRAND.tealDeep};">BOOK</strong> and Kalee will help arrange your appointment.
      </div>
    </td></tr>
  </table>

  <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${BRAND.muted};">
    <strong style="color:${BRAND.tealDeep};">Clinic:</strong> ${escapeHtml(CLINIC_ADDRESS_LINE)}
  </p>
  <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${BRAND.muted};">
    Please keep any existing paediatrician appointment. Paediatrician fees are separate.
  </p>
</td></tr>

<!-- Signature -->
<tr><td style="background:${BRAND.paper};padding:4px 24px 24px;border-left:1px solid ${BRAND.tealBorder};border-right:1px solid ${BRAND.tealBorder};">
  <div style="height:1px;background:${BRAND.tealBorder};margin:0 0 18px;"></div>
  <p style="margin:0;font-size:14px;color:${BRAND.ink};line-height:1.5;">Kind regards,</p>
  <p style="margin:10px 0 0;font-size:16px;font-weight:800;color:${BRAND.tealDeep};letter-spacing:-0.2px;">Kalee</p>
  <p style="margin:2px 0 0;font-size:13px;color:${BRAND.muted};">Administration · Azure Mind</p>
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
  const child = fields.childFirst.trim() || "your child";
  return pathwayCopy(fields.assessmentType, child).subject;
}

export function getParentBookingSms(fields: ParentBookingFields): string {
  const child = fields.childFirst.trim() || "your child";
  const parent = fields.parentFirst.trim();
  const hi = parent ? `Hi ${parent}` : "Hi";
  const booking = normalizeBookingHref(fields.bookingLink);
  const phone = fields.clinicPhone.trim() || "0422 182 967";
  const label =
    fields.assessmentType === "ADHD"
      ? "ADHD assessment"
      : fields.assessmentType === "ASD"
        ? "autism assessment"
        : "learning assessment";
  return `${hi}, Azure Mind here.\n\nPerth Paediatrics shared ${child}'s referral with us for the psychology stage of their ${label}.\n\nBook online:\n${booking}\n\nNeed help? Reply BOOK or call/text ${phone}.\n\n— Kalee, Azure Mind`;
}

export function feeOptionsForPathway(pathway: ParentBookingPathway): FeeOption[] {
  return FEES[pathway];
}
