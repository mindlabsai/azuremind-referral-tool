"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PIN = "azuremind";

const AUTH_STORAGE_KEY = "azuremind_referral_engine_auth";

const DEFAULT_BOOKING_LINK =
  "https://azurepsychology-cockburn.au1.cliniko.com/bookings";
const DEFAULT_CLINIC_PHONE = "0422 182 967";

type AssessmentType = "ADHD" | "ASD" | "SLD";

type SentChannel = "email+sms" | "email" | "sms";

type SentEntry = {
  id: string;
  at: string;
  childFirst: string;
  childLast: string;
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
  internalNotes: string;
  referrerName: string;
  referrerType: string;
  referrerEmail: string;
  channel: SentChannel;
};

type ReferralIntelFilter = "today" | "week" | "month" | "30d" | "custom";

type ReferralApiRow = {
  id?: string | number;
  created_at?: string;
  child_first_name?: string | null;
  child_last_name?: string | null;
  child_dob?: string | null;
  parent_first_name?: string | null;
  parent_last_name?: string | null;
  parent_email?: string | null;
  parent_mobile?: string | null;
  assessment_type?: string | null;
  booking_link?: string | null;
  clinic_phone?: string | null;
  sent_email?: boolean | null;
  sent_sms?: boolean | null;
  send_status?: string | null;
  notes?: string | null;
};

function mapReferralApiRowToSentEntry(row: ReferralApiRow): SentEntry | null {
  const idRaw = row.id;
  if (idRaw === undefined || idRaw === null) return null;
  const id = String(idRaw).trim();
  if (!id) return null;
  const created = row.created_at;
  if (!created || typeof created !== "string") return null;

  const rawType = (row.assessment_type ?? "").trim().toUpperCase();
  let assessmentTypeNorm: AssessmentType = "ADHD";
  if (rawType === "ASD" || rawType === "SLD" || rawType === "ADHD") {
    assessmentTypeNorm = rawType as AssessmentType;
  }

  const se = !!row.sent_email;
  const ss = !!row.sent_sms;
  let channel: SentChannel;
  if (se && ss) channel = "email+sms";
  else if (se && !ss) channel = "email";
  else if (!se && ss) channel = "sms";
  else {
    const st = (row.send_status ?? "").toLowerCase();
    if (st.includes("email") && st.includes("sms")) channel = "email+sms";
    else if (st.includes("sms")) channel = "sms";
    else if (st.includes("email")) channel = "email";
    else channel = "email";
  }

  return {
    id,
    at: created,
    childFirst: String(row.child_first_name ?? ""),
    childLast: String(row.child_last_name ?? ""),
    childDob: String(row.child_dob ?? ""),
    parentFirst: String(row.parent_first_name ?? ""),
    parentLast: String(row.parent_last_name ?? ""),
    parentEmail: String(row.parent_email ?? ""),
    parentMobile: String(row.parent_mobile ?? ""),
    assessmentType: assessmentTypeNorm,
    bookingLink: String(row.booking_link ?? ""),
    clinicPhone: String(row.clinic_phone ?? ""),
    internalNotes: String(row.notes ?? ""),
    referrerName: "",
    referrerType: "",
    referrerEmail: "",
    channel,
  };
}

function startOfLocalMonday(now: Date): Date {
  const d = new Date(now);
  const day = d.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - daysFromMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatReferralLastActivity(created: Date, now: Date): string {
  const diffMinutes = Math.floor(
    (now.getTime() - created.getTime()) / 60000
  );

  if (diffMinutes >= 0 && diffMinutes < 1) return "Just now";
  if (diffMinutes >= 1 && diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const dayStart = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const todayStart = dayStart(now);
  const createdDayStart = dayStart(created);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(created.getHours())}:${pad(created.getMinutes())}`;

  if (createdDayStart === todayStart) {
    return `Today at ${hhmm}`;
  }
  if (createdDayStart === yesterdayStart) {
    return `Yesterday at ${hhmm}`;
  }

  return `${pad(created.getDate())}/${pad(created.getMonth() + 1)}/${created.getFullYear()}, ${hhmm}`;
}

type RegisterPeriodFilter = "today" | "week" | "month" | "all";

function sentRegisterEntryInPeriod(
  atIso: string,
  period: RegisterPeriodFilter,
  now: Date
): boolean {
  if (period === "all") return true;
  const t = new Date(atIso).getTime();
  if (Number.isNaN(t)) return false;
  let start: Date;
  if (period === "today") {
    start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
  } else if (period === "week") {
    start = startOfLocalMonday(now);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  return t >= start.getTime() && t <= now.getTime();
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pathwayFaqCardHtml(question: string, answer: string): string {
  return (
    '<div style="margin:16px 0;">' +
    '<div style="background:#0E5F63;color:#fff;padding:12px 14px;font-weight:700;border-radius:8px 8px 0 0;">' +
    escapeHtml(question) +
    "</div>" +
    '<div style="border:1px solid #D9E5E5;border-top:none;padding:14px;background:#F8FBFB;border-radius:0 0 8px 8px;font-size:14px;color:#2c4a4c;line-height:1.65;">' +
    escapeHtml(answer).replace(/\n/g, "<br/>") +
    "</div></div>"
  );
}

function sldStyledFaqHtml(clinicPhone: string): string {
  return (
    pathwayFaqCardHtml(
      "Is this a diagnostic assessment?",
      "Yes. This is a Learning Diagnostic Assessment. It investigates whether your child meets criteria for a Specific Learning Disorder and provides a written Report outlining findings and recommendations."
    ) +
    pathwayFaqCardHtml(
      "Is this the same as dyslexia, dysgraphia, or dyscalculia?",
      "Specific Learning Disorder is the formal diagnostic term. It can include difficulties in reading, written expression, spelling, or mathematics."
    ) +
    pathwayFaqCardHtml(
      "Will the Report help with school support?",
      "Yes. The Report is structured to support school planning, learning adjustments, and recommendations for classroom and assessment support where relevant."
    ) +
    pathwayFaqCardHtml(
      "Is online testing appropriate for learning assessments?",
      "The Assessment uses Pearson\u2019s secure Digital WIAT platform and is administered in a structured manner via Video Telehealth. The testing process remains standardised and guided throughout the session."
    ) +
    pathwayFaqCardHtml(
      "What if my child does not meet criteria for SLD?",
      "The Report will outline the most likely explanation for your child\u2019s learning profile and provide practical recommendations for next steps."
    ) +
    pathwayFaqCardHtml(
      "Are there any rebates available?",
      "Private health rebates may apply to the Psychological Assessment component, depending on your level of cover."
    ) +
    pathwayFaqCardHtml(
      "Can we reschedule or cancel an appointment?",
      "Yes. We require at least 48 hours\u2019 notice. Please call or text " +
        clinicPhone +
        " to make changes."
    )
  );
}

function adhdStyledFaqHtml(clinicPhone: string): string {
  return (
    pathwayFaqCardHtml(
      "Is this a diagnosis or just an assessment?",
      "This is a Diagnostic Assessment. Psychologists are trained to assess and diagnose ADHD, and the outcome is clearly outlined in the Report."
    ) +
    pathwayFaqCardHtml(
      "What if ADHD is not identified?",
      "The Report will outline the most likely explanation for your child\u2019s presentation and provide clear, practical recommendations for next steps."
    ) +
    pathwayFaqCardHtml(
      "Do we need a GP referral?",
      "Yes. A GP referral is required to see Dr Murugesh Nidyananda. This can be arranged following your Assessment if needed.\n\nFor GP referrals:\nHealthLink (preferred): sageclin\nFax: (08) 6288 1663\nEmail: referrals@sageclinic.com.au"
    ) +
    pathwayFaqCardHtml(
      "Why might we need to see a Psychiatrist?",
      "Where medication is identified as a clinical need, Medical Review is required. In Australia, medication is typically a first-line treatment for ADHD and must be prescribed and managed by a Paediatrician or Psychiatrist."
    ) +
    pathwayFaqCardHtml(
      "Are there any rebates available?",
      "Private health rebates may apply to the Psychological Assessment, depending on your level of cover."
    ) +
    pathwayFaqCardHtml(
      "Can we reschedule or cancel an appointment?",
      "Yes. We require at least 48 hours\u2019 notice for rescheduling or cancellations. Please call or text " +
        clinicPhone +
        " to make changes to your appointment."
    )
  );
}

function asdStyledFaqHtml(clinicPhone: string): string {
  return (
    pathwayFaqCardHtml(
      "Is this a formal Autism diagnosis?",
      "This is a structured Diagnostic Assessment completed using a Consensus Pathway aligned with national guidelines. Diagnostic Confirmation is provided through the combined Psychological and Medical Assessment process where required."
    ) +
    pathwayFaqCardHtml(
      "Why is a Paediatrician or Psychiatrist involved?",
      "Autism assessments can be completed using different combinations of professionals. The Consensus Assessment Pathway combines Psychological Assessment with Medical Review within a single, coordinated process.\n\nThis ensures that both developmental and medical considerations are addressed where relevant, rather than being separated across different services."
    ) +
    pathwayFaqCardHtml(
      "Do we need to complete both stages?",
      "Not always. Stage 1 provides a clear clinical position. Where Diagnostic Confirmation is required, Stage 2 completes the Consensus process."
    ) +
    pathwayFaqCardHtml(
      "Will this be suitable for NDIS or school support?",
      "Where Autism is identified, documentation from the Assessment Pathway can be used to support applications and planning for services such as NDIS, where applicable."
    ) +
    pathwayFaqCardHtml(
      "What if my child does not meet Autism diagnosis?",
      "The Report will outline the most likely explanation for your child\u2019s presentation and provide clear, practical recommendations for next steps."
    ) +
    pathwayFaqCardHtml(
      "Are there any rebates available?",
      "Private health rebates may apply to the Psychological Assessment component, depending on your level of cover."
    ) +
    pathwayFaqCardHtml(
      "Can we reschedule or cancel an appointment?",
      "Yes. We require at least 48 hours\u2019 notice for rescheduling or cancellations. Please call or text " +
        clinicPhone +
        " to make changes to your appointment."
    )
  );
}

type TemplateData = {
  child_first_name: string;
  child_last_name: string;
  child_dob: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_name: string;
  parent_email: string;
  parent_mobile: string;
  assessment_type: AssessmentType;
  booking_link: string;
  clinic_phone: string;
};

type PathwayTemplate = {
  email_subject: string;
  email_title: string;
  email_body_plain: string;
  sms_body: string;
};

const TEMPLATES: Record<AssessmentType, PathwayTemplate> = {

  ADHD: {
    email_subject: "ADHD Assessment Pathway \u2013 Process & Next Steps",
    email_title: "ADHD Assessment Pathway",
    email_body_plain: [
      "Dear Parent,",
      "",
      "We have received a referral for your child {{child_first_name}} for an ADHD Diagnostic Assessment.",
      "",
      "We use a structured ADHD Assessment Pathway designed to provide a clear clinical outcome early, while ensuring the appropriate level of care is identified from the outset.",
      "",
      "ASSESSMENT OPTIONS, FEES & AVAILABILITY",
      "",
      "Telehealth Video Assessment \u2014 $650",
      "In-Clinic Assessment \u2014 $1,150",
      "",
      "Both formats follow the same Clinical Assessment framework.",
      "",
      "Private health rebates may apply to the Psychological Assessment component, depending on your level of cover.",
      "",
      "Current availability: typically within 2\u20133 weeks.",
      "",
      "HOW THE ASSESSMENT WORKS",
      "",
      "The Assessment is a structured 60-minute appointment with Vishal Maharaj, Registered Psychologist, conducted via telehealth or in-clinic.",
      "",
      "Your child should be present, along with at least one caregiver.",
      "",
      "The Assessment includes:",
      "\u2022 Screening and Clinical Assessment",
      "\u2022 Detailed Developmental History",
      "\u2022 Review of School Reports and relevant information",
      "\u2022 Standardised ADHD Measures",
      "\u2022 Clinical Formulation",
      "",
      "A comprehensive written Report is provided within 2\u20134 weeks following the Assessment. This clearly outlines whether ADHD is present, the clinical reasoning, and recommended next steps. The Report is typically available prior to any Medical Review.",
      "",
      "WHAT HAPPENS NEXT",
      "",
      "Where ADHD is identified and medication is being considered, your child proceeds within the same structured pathway to Medical Review with Dr Murugesh Nidyananda, Child and Adolescent Psychiatrist, via video telehealth.",
      "",
      "As the Assessment and Report are already completed, this allows for a more direct and efficient Psychiatric Review where required.",
      "",
      "A GP referral is required to proceed with Psychiatric Review. This can be arranged following your Assessment if needed.",
      "",
      "Not all children require Medical Review. Where ADHD is not identified, the Report provides clear explanations and practical recommendations for next steps.",
      "",
      "NEXT STEP",
      "",
      "Book your Assessment online below \u2014 this takes less than 60 seconds.",
      "",
      "[CTA_BUTTON]",
      "",
      "If you have any questions or would prefer assistance, you can reply to this email or call/text {{clinic_phone}}.",
      "",
      "COMMON QUESTIONS FROM PARENTS",
      "",
      "[ADHD_STYLED_FAQ]",
      "",
      "Warm regards,",
      "Azure Mind",
    ].join("\n"),
    sms_body:
      "Dear Parent, Azure Mind here:\n\nWe have received a referral for your child {{child_first_name}} for an ADHD Diagnostic Assessment.\n\nAppointments are available within 2\u20133 weeks, with a clear clinical outcome and next steps.\n\nBook online:\n{{booking_link}}\n\nReply or call/text {{clinic_phone}} for assistance.",
  },

  ASD: {
    email_subject: "Autism Consensus Assessment Pathway \u2013 Next Steps",
    email_title: "Autism Consensus Assessment Pathway",
    email_body_plain: [
      "Dear Parent,",
      "",
      "We have received a referral for your child {{child_first_name}} for an Autism Diagnostic Assessment.",
      "",
      "We use a structured Autism Consensus Assessment Pathway aligned with the Australian National Guideline for the Assessment and Diagnosis of Autism. This approach is designed to provide a clear, clinically supported outcome while ensuring the appropriate level of care is identified from the outset.",
      "",
      "The multidisciplinary consensus team consists of:",
      "",
      "Vishal Maharaj, Registered Psychologist",
      "Dr Chaandini Subramaniam, Developmental Paediatrician",
      "Dr Murugesh Nidyananda, Child and Adolescent Psychiatrist",
      "",
      "",
      "ASSESSMENT OPTIONS, FEES & AVAILABILITY",
      "",
      "Telehealth Video Assessment \u2014 $1,850",
      "In-Clinic Assessment \u2014 $2,000",
      "",
      "Private health rebates may apply to the Psychological Assessment component, depending on your level of cover.",
      "",
      "Current availability for Stage 1: typically within 2\u20134 weeks.",
      "",
      "",
      "HOW THE CONSENSUS ASSESSMENT WORKS",
      "",
      "The Assessment is completed in two structured stages.",
      "",
      "Stage 1 \u2014 Psychological Assessment",
      "",
      "This is a structured 90-minute Assessment with Vishal Maharaj, Registered Psychologist, conducted via secure Video Telehealth or in-clinic.",
      "",
      "The Assessment includes:",
      "\u2022 Clinical Interview and Developmental History",
      "\u2022 Review of School Reports and functional presentation",
      "\u2022 Standardised Autism Measures",
      "\u2022 Clinical Formulation",
      "",
      "A comprehensive written Report is provided following this Assessment. This outlines whether Autism is present, the clinical reasoning, and recommended next steps. The Report is typically available within 2\u20134 weeks and is used to guide the next stage of the pathway.",
      "",
      "",
      "WHAT TO EXPECT \u2014 VIDEO TELEHEALTH ASSESSMENT",
      "",
      "Many families choose Video Telehealth for Autism Assessment. When structured appropriately, this allows for a thorough and clinically valid process.",
      "",
      "The Assessment is conducted via secure video using a private link, with your child and caregiver present.",
      "",
      "The session includes:",
      "\u2022 Observation and interaction with your child",
      "\u2022 Developmental history with a caregiver",
      "\u2022 Structured, guided engagement throughout",
      "",
      "For many children, this can support:",
      "\u2022 More natural presentation in a familiar environment",
      "\u2022 Reduced masking or shutdown behaviours sometimes seen in clinic settings",
      "\u2022 More consistent engagement with lower sensory and environmental demands",
      "",
      "Video Telehealth can also reduce the need for:",
      "\u2022 Transitions into unfamiliar settings",
      "\u2022 Travel time",
      "\u2022 Additional childcare arrangements",
      "",
      "The Assessment, Report, and overall pathway remain the same regardless of whether Video Telehealth or in-clinic options are selected.",
      "",
      "",
      "Stage 2 \u2014 Medical Assessment",
      "",
      "Following the Psychological Assessment, families proceed within the same structured pathway to Medical Review for Diagnostic Confirmation.",
      "",
      "This is completed with either:",
      "",
      "Dr Chaandini Subramaniam \u2014 Developmental Paediatrician (In-Clinic)",
      "or",
      "Dr Murugesh Nidyananda \u2014 Child and Adolescent Psychiatrist (Video Telehealth)",
      "",
      "This stage provides:",
      "\u2022 Diagnostic Confirmation",
      "\u2022 Consideration of developmental and medical factors",
      "\u2022 Documentation for support services, including NDIS where applicable",
      "\u2022 Medical oversight where required",
      "",
      "As the Psychological Assessment and Report are already completed, this allows for a more direct and coordinated Medical Review.",
      "",
      "Medical Review is arranged directly with the Paediatrician or Psychiatrist and is billed separately.",
      "",
      "",
      "Not all children progress through both stages. Where Autism is not identified, the Report provides a clear explanation of your child\u2019s presentation along with practical recommendations for next steps.",
      "",
      "",
      "NEXT STEP",
      "",
      "Book your Assessment online below \u2014 this takes less than 60 seconds.",
      "",
      "[CTA_BUTTON]",
      "",
      "If you have any questions or would prefer assistance, you can reply to this email or call/text {{clinic_phone}}.",
      "",
      "COMMON QUESTIONS FROM PARENTS",
      "",
      "[ASD_STYLED_FAQ]",
      "",
      "Warm regards,",
      "Azure Mind",
    ].join("\n"),
    sms_body: "Dear Parent, Azure Mind here:\n\nWe have received a referral for {{child_first_name}} for an autism assessment.\n\nBook online here:\n{{booking_link}}\n\nReply or call/text {{clinic_phone}} if you need help."
  },

  SLD: {
    email_subject: "Learning Assessment Pathway \u2013 Process & Next Steps",
    email_title: "Specific Learning Disorder Assessment Pathway",
    email_body_plain: [
      "Dear Parent,",
      "",
      "We have received an enquiry regarding a Learning Diagnostic Assessment for your child {{child_first_name}}.",
      "",
      "This Assessment is designed to investigate whether a Specific Learning Disorder is present and to provide clear recommendations for school, home, and further support where required.",
      "",
      "",
      "ASSESSMENT OPTIONS, FEES & AVAILABILITY",
      "",
      "Specific Learning Disorder Assessment \u2014 $2,200",
      "Specific Learning Disorder + ADHD Combined Assessment \u2014 $2,500",
      "CTOPP add-on, where required for Years 9\u201312 \u2014 $200",
      "",
      "Private health rebates may apply to the Psychological Assessment component, depending on your level of cover.",
      "",
      "Current availability: typically within 2\u20134 weeks.",
      "",
      "",
      "HOW THE ASSESSMENT WORKS",
      "",
      "The Assessment is completed via secure Video Telehealth with Vishal Maharaj, Registered Psychologist.",
      "",
      "Your child and at least one caregiver should be present.",
      "",
      "The Assessment includes:",
      "\u2022 Clinical Interview and Developmental History",
      "\u2022 Review of School Reports and relevant learning information",
      "\u2022 Standardised Academic Testing",
      "\u2022 Assessment of reading, writing, spelling, and mathematics",
      "\u2022 Clinical Formulation",
      "\u2022 Practical recommendations for school and home",
      "",
      "The Assessment uses the Digital WIAT through Pearson\u2019s secure Q-global platform. This is a standardised assessment platform used for educational and psychological testing.",
      "",
      "Where ADHD is also being considered, additional clinical measures and interview components are included to assess attention, hyperactivity, executive functioning, and learning impact.",
      "",
      "",
      "WHAT THE ASSESSMENT CAN CLARIFY",
      "",
      "The Assessment investigates whether your child meets criteria for a Specific Learning Disorder.",
      "",
      "\u2022 Dyslexia \u2014 difficulties with reading",
      "\u2022 Dysgraphia \u2014 difficulties with writing or written expression",
      "\u2022 Dyscalculia \u2014 difficulties with mathematics",
      "",
      "The DSM-5-TR uses the formal diagnostic term Specific Learning Disorder.",
      "",
      "A comprehensive written Report is provided within 2\u20134 weeks following the Assessment. The Report outlines findings, clinical reasoning, diagnostic impressions, and clear recommendations.",
      "",
      "\u2022 School-based learning adjustments",
      "\u2022 Classroom and assessment accommodations",
      "\u2022 Home-based learning strategies",
      "\u2022 Referral or support recommendations where required",
      "\u2022 SCSA-related documentation guidance where relevant",
      "",
      "",
      "WHAT TO EXPECT \u2014 VIDEO TELEHEALTH ASSESSMENT",
      "",
      "The Assessment is conducted via secure video using a private link.",
      "",
      "For many children and adolescents, Video Telehealth can support focused engagement while reducing the pressure of travel, waiting rooms, and unfamiliar clinical settings.",
      "",
      "The testing process remains structured and standardised. Instructions are provided clearly during the session, and caregiver support is used where appropriate.",
      "",
      "The Assessment, Report, and recommendations remain the same whether the Assessment is completed via Video Telehealth or in-clinic.",
      "",
      "",
      "FOR STUDENTS IN YEARS 9\u201312",
      "",
      "Where SCSA documentation is required, additional assessment of phonological processing may be needed.",
      "",
      "If this is clinically indicated, a CTOPP assessment can be added for $200.",
      "",
      "",
      "WHAT IF A SPECIFIC LEARNING DISORDER IS NOT IDENTIFIED?",
      "",
      "Not all learning difficulties are due to a Specific Learning Disorder.",
      "",
      "Where SLD is not identified, the Report will outline the most likely explanation for your child\u2019s learning profile and provide practical recommendations for next steps.",
      "",
      "",
      "NEXT STEP",
      "",
      "[CTA_BUTTON]",
      "",
      "If you have any questions or would prefer assistance, call/text {{clinic_phone}}.",
      "",
      "",
      "COMMON QUESTIONS FROM PARENTS",
      "",
      "[SLD_STYLED_FAQ]",
      "",
      "Warm regards,",
      "Azure Mind",
    ].join("\n"),
    sms_body: "Dear Parent, Azure Mind here:\n\nWe have received your enquiry about a learning assessment for {{child_first_name}}.\n\nAppointments are generally available within 2\u20134 weeks.\n\nInfo and booking:\n{{booking_link}}\n\nReply or call/text {{clinic_phone}} if you would like help."
  }

};

function toTemplateData(fields: {
  childFirst: string;
  childLast: string;
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
}): TemplateData {
  return {
    child_first_name: fields.childFirst.trim() || "your child",
    child_last_name: fields.childLast.trim(),
    child_dob: fields.childDob.trim(),
    parent_first_name: fields.parentFirst.trim(),
    parent_last_name: fields.parentLast.trim(),
    parent_name: `${fields.parentFirst.trim()} ${fields.parentLast.trim()}`.trim(),
    parent_email: fields.parentEmail.trim(),
    parent_mobile: fields.parentMobile.trim(),
    assessment_type: fields.assessmentType,
    booking_link: fields.bookingLink.trim(),
    clinic_phone: fields.clinicPhone.trim() || DEFAULT_CLINIC_PHONE,
  };
}

function renderTemplate(str: string, data: TemplateData): string {
  return str
    .replace(/\{\{child_first_name\}\}/g, data.child_first_name)
    .replace(/\{\{parent_name\}\}/g, data.parent_name || "")
    .replace(/\{\{booking_link\}\}/g, data.booking_link || "[BOOKING LINK NOT SET]")
    .replace(/\{\{clinic_phone\}\}/g, data.clinic_phone);
}

function parsePlainToHtmlString(
  plain: string,
  bookingLink: string,
  clinicPhone?: string
) {
  const lines = plain.split("\n");
  let html = "";
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "[SLD_STYLED_FAQ]") {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += sldStyledFaqHtml(clinicPhone ?? "");
      continue;
    }

    if (line.trim() === "[ADHD_STYLED_FAQ]") {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += adhdStyledFaqHtml(clinicPhone ?? "");
      continue;
    }

    if (line.trim() === "[ASD_STYLED_FAQ]") {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += asdStyledFaqHtml(clinicPhone ?? "");
      continue;
    }

    if (line.trim() === "[CTA_BUTTON]") {
      if (inList) { html += "</ul>"; inList = false; }
      const href = bookingLink || "#";
      html += '<div style="text-align:center;margin:26px 0 8px;">' +
        '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer" ' +
        'style="display:inline-block;background:#0E5F63;color:#fff;text-decoration:none;' +
        'font-size:15px;font-weight:700;padding:15px 38px;border-radius:10px;letter-spacing:-0.2px;">' +
        'Book Online</a></div>';
      continue;
    }

    // Section headings
    if (line.trim().length > 3 && !line.startsWith('\u2022') &&
        /^[A-Z0-9\s\u2013\u2014&\/\-\(\)\.\+]+$/.test(line.trim())) {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<h3 style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;' +
        'color:#0E5F63;margin:24px 0 8px;padding-bottom:6px;border-bottom:1px solid #E3F0F1;">' + escapeHtml(line) + '</h3>';
    }
    // Bullets
    else if (line.startsWith('\u2022')) {
      if (!inList) { html += '<ul style="margin:6px 0 6px 0;padding-left:0;list-style:none;">'; inList = true; }
      html += '<li style="padding:3px 0 3px 18px;position:relative;font-size:14px;color:#2c4a4c;line-height:1.65;">' +
        '<span style="position:absolute;left:2px;color:#2A8F94;">\u2022</span>' + escapeHtml(line.slice(1).trim()) + '</li>';
    }
    // Empty
    else if (line.trim() === '') {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<div style="height:8px;"></div>';
    }
    // Normal
    else {
      if (inList) { html += '</ul>'; inList = false; }
      html += '<p style="margin:0 0 4px;font-size:14px;color:#2c4a4c;line-height:1.7;">' + escapeHtml(line) + '</p>';
    }
  }
  if (inList) html += '</ul>';
  return html;
}

function buildFullEmailHtmlString(data: TemplateData, template: PathwayTemplate): string {
  const rendered = renderTemplate(template.email_body_plain, data);
  const bodyHtml = parsePlainToHtmlString(
    rendered,
    data.booking_link,
    data.clinic_phone
  );
  const subject = renderTemplate(template.email_subject, data);

  return '<!DOCTYPE html>\n<html lang="en">\n<head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<title>' + escapeHtml(subject) + '</title></head>\n' +
    '<body style="margin:0;padding:0;background:#F4F7F7;' +
    'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Helvetica,Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7F7;padding:28px 12px 40px;">' +
    '<tr><td align="center">' +
    '<table width="100%" style="max-width:580px;" cellpadding="0" cellspacing="0">' +
    '<tr><td style="background:#0E5F63;border-radius:12px 12px 0 0;padding:26px 32px;">' +
    '<div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:8px;padding:6px 16px;' +
    'font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;">Azure Mind</div>' +
    '<div style="color:rgba(255,255,255,0.68);font-size:12px;margin-top:6px;">Psychology &amp; Assessment</div>' +
    '</td></tr>' +
    '<tr><td style="background:#0A474A;padding:14px 32px;">' +
    '<div style="font-size:16px;font-weight:700;color:#fff;">' + escapeHtml(template.email_title) + '</div>' +
    '</td></tr>' +
    '<tr><td style="background:#fff;padding:32px 32px 28px;border-left:1px solid #D9E5E5;border-right:1px solid #D9E5E5;">' +
    bodyHtml + '</td></tr>' +
    '<tr><td style="background:#F8FBFB;border:1px solid #D9E5E5;border-top:none;' +
    'border-radius:0 0 12px 12px;padding:18px 32px;">' +
    '<p style="font-size:11px;color:#647477;line-height:1.65;margin:0;">' +
    'Azure Mind Psychology | Perth, Western Australia<br>' +
    'Vishal Maharaj is a Registered Psychologist registered with AHPRA.<br>' +
    'This communication contains general information about our assessment services and is not clinical advice.<br>' +
    'For assistance, contact us at <strong style="color:#0E5F63;">' + escapeHtml(data.clinic_phone) + '</strong>.' +
    '</p></td></tr>' +
    '</table></td></tr></table></body></html>';
}


function buildParentEmailHtml(fields: {
  childFirst: string;
  childLast: string;
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
}): string {
  const data = toTemplateData(fields);
  const template = TEMPLATES[fields.assessmentType];
  return buildFullEmailHtmlString(data, template);
}

function buildSmsText(fields: {
  childFirst: string;
  childLast: string;
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
}): string {
  const data = toTemplateData(fields);
  const template = TEMPLATES[fields.assessmentType];
  return renderTemplate(template.sms_body, data);
}


export default function Home() {
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const [childFirst, setChildFirst] = useState("");
  const [childLast, setChildLast] = useState("");
  const [childDob, setChildDob] = useState("");
  const [parentFirst, setParentFirst] = useState("");
  const [parentLast, setParentLast] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentMobile, setParentMobile] = useState("");
  const [assessmentType, setAssessmentType] = useState<AssessmentType>("ADHD");
  const [bookingLink, setBookingLink] = useState(DEFAULT_BOOKING_LINK);
  const [clinicPhone, setClinicPhone] = useState(DEFAULT_CLINIC_PHONE);
  const [internalNotes, setInternalNotes] = useState("");

  const [referrerName, setReferrerName] = useState("");
  const [referrerType, setReferrerType] = useState("");
  const [referrerEmail, setReferrerEmail] = useState("");

  const [previewEmailHtml, setPreviewEmailHtml] = useState("");
  const [previewSms, setPreviewSms] = useState("");
  const [previewReady, setPreviewReady] = useState(false);

  const [sentRegister, setSentRegister] = useState<SentEntry[]>([]);
  const [sendStatus, setSendStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [referralsRows, setReferralsRows] = useState<ReferralApiRow[]>([]);
  const [dateIntelFilter, setDateIntelFilter] =
    useState<ReferralIntelFilter>("today");
  const [intelCustomFrom, setIntelCustomFrom] = useState("");
  const [intelCustomTo, setIntelCustomTo] = useState("");
  const [intelCustomAppliedFrom, setIntelCustomAppliedFrom] = useState("");
  const [intelCustomAppliedTo, setIntelCustomAppliedTo] = useState("");

  const [registerPeriodFilter, setRegisterPeriodFilter] =
    useState<RegisterPeriodFilter>("all");
  const [registerShowAllHistory, setRegisterShowAllHistory] = useState(false);

  const childFirstNameRef = useRef<HTMLInputElement>(null);

  function scrollToTopAndFocus() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => childFirstNameRef.current?.focus(), 250);
  }

  useEffect(() => {
    try {
      if (typeof window !== "undefined" && localStorage.getItem(AUTH_STORAGE_KEY)) {
        setUnlocked(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (signingIn) return;
    setSigningIn(true);
    window.setTimeout(() => {
      if (pinInput.trim().toLowerCase() === PIN.toLowerCase()) {
        try {
          localStorage.setItem(AUTH_STORAGE_KEY, "1");
        } catch {
          /* ignore */
        }
        setUnlocked(true);
        setPinError(null);
      } else {
        setPinError("Incorrect password");
      }
      setSigningIn(false);
    }, 120);
  };

  const signOut = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setUnlocked(false);
    setPinInput("");
    setPinError(null);
  };

  const validateCoreFields = useCallback((): boolean => {
    if (
      !childFirst.trim() ||
      !childLast.trim() ||
      !childDob.trim() ||
      !parentFirst.trim() ||
      !parentLast.trim() ||
      !parentMobile.trim() ||
      !bookingLink.trim() ||
      !clinicPhone.trim()
    ) {
      setSendStatus({
        type: "error",
        message:
          "Send failed: Please complete all required fields before continuing.",
      });
      setTimeout(() => setSendStatus(null), 3500);
      return false;
    }
    return true;
  }, [
    childFirst,
    childLast,
    childDob,
    parentFirst,
    parentLast,
    parentMobile,
    bookingLink,
    clinicPhone,
  ]);

  useEffect(() => {
    const fields = {
      childFirst,
      childLast,
      childDob,
      parentFirst,
      parentLast,
      parentEmail,
      parentMobile,
      assessmentType,
      bookingLink,
      clinicPhone,
    };
    setPreviewEmailHtml(buildParentEmailHtml(fields));
    setPreviewSms(buildSmsText(fields));
    setPreviewReady(true);
  }, [
    childFirst,
    childLast,
    childDob,
    parentFirst,
    parentLast,
    parentEmail,
    parentMobile,
    assessmentType,
    bookingLink,
    clinicPhone,
  ]);

  const sendEmailWithCurrentForm = useCallback(async (): Promise<boolean> => {
    const fields = {
      childFirst,
      childLast,
      childDob,
      parentFirst,
      parentLast,
      parentEmail,
      parentMobile,
      assessmentType,
      bookingLink,
      clinicPhone,
    };
    const data = toTemplateData(fields);
    const selectedTemplate = TEMPLATES[assessmentType];
    const subject = renderTemplate(selectedTemplate.email_subject, data);

    let currentEmailHtml = previewEmailHtml;
    if (!previewReady || !currentEmailHtml) {
      currentEmailHtml = buildParentEmailHtml(fields);
      setPreviewEmailHtml(currentEmailHtml);
      setPreviewSms(buildSmsText(fields));
      setPreviewReady(true);
    }

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: parentEmail,
          subject,
          html: currentEmailHtml,
        }),
      });
      const json = (await res.json()) as { success?: boolean };
      return res.ok && json.success === true;
    } catch {
      return false;
    }
  }, [
    childFirst,
    childLast,
    childDob,
    parentFirst,
    parentLast,
    parentEmail,
    parentMobile,
    assessmentType,
    bookingLink,
    clinicPhone,
    previewReady,
    previewEmailHtml,
  ]);

  const sendSmsWithCurrentForm = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    const fields = {
      childFirst,
      childLast,
      childDob,
      parentFirst,
      parentLast,
      parentEmail,
      parentMobile,
      assessmentType,
      bookingLink,
      clinicPhone,
    };
    const message = buildSmsText(fields);
    setPreviewSms(message);
    setPreviewReady(true);
    try {
      const res = await fetch("/api/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: parentMobile,
          message,
        }),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
      };
      if (res.ok && json.success === true) {
        return { ok: true };
      }
      return {
        ok: false,
        error: json.error ?? `HTTP ${res.status}`,
      };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
      };
    }
  }, [
    childFirst,
    childLast,
    childDob,
    parentFirst,
    parentLast,
    parentEmail,
    parentMobile,
    assessmentType,
    bookingLink,
    clinicPhone,
  ]);

  const loadReferrals = useCallback(async () => {
    try {
      const res = await fetch("/api/referrals");
      const json = (await res.json()) as {
        success?: boolean;
        data?: unknown;
        error?: string;
      };
      if (!res.ok || json.success !== true || !Array.isArray(json.data)) {
        console.error(
          "Referrals fetch failed:",
          res.status,
          json.error ?? json
        );
        setReferralsRows([]);
        setSentRegister([]);
        return;
      }
      const rows = json.data as ReferralApiRow[];
      setReferralsRows(rows);
      const sorted = [...rows].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return tb - ta;
      });
      setSentRegister(
        sorted
          .map(mapReferralApiRowToSentEntry)
          .filter((e): e is SentEntry => e !== null)
      );
    } catch (e) {
      console.error("Referrals fetch error:", e);
      setReferralsRows([]);
      setSentRegister([]);
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    void loadReferrals();
  }, [unlocked, loadReferrals]);

  const intelRangeBounds = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    switch (dateIntelFilter) {
      case "today":
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0
        );
        break;
      case "week":
        start = startOfLocalMonday(now);
        break;
      case "month":
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case "30d":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "custom": {
        const fromStr = intelCustomAppliedFrom.trim();
        const toStr = intelCustomAppliedTo.trim();
        if (!fromStr || !toStr) {
          start = new Date(8640000000000000);
          end = new Date(0);
        } else {
          const [fy, fm, fd] = fromStr.split("-").map(Number);
          const [ty, tm, td] = toStr.split("-").map(Number);
          start = new Date(fy, fm - 1, fd, 0, 0, 0, 0);
          end = new Date(ty, tm - 1, td, 23, 59, 59, 999);
        }
        break;
      }
      default:
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          0,
          0,
          0,
          0
        );
    }
    return { start, end };
  }, [dateIntelFilter, intelCustomAppliedFrom, intelCustomAppliedTo]);

  const intelligenceStats = useMemo(() => {
    const startMs = intelRangeBounds.start.getTime();
    const endMs = intelRangeBounds.end.getTime();
    let total = 0;
    let adhd = 0;
    let asd = 0;
    let sld = 0;
    let emailSms = 0;
    let emailOnly = 0;
    let smsOnly = 0;
    for (const r of referralsRows) {
      const ca = r.created_at;
      if (!ca || typeof ca !== "string") continue;
      const t = new Date(ca).getTime();
      if (Number.isNaN(t) || t < startMs || t > endMs) continue;
      total++;
      const at = (r.assessment_type ?? "").toLowerCase().trim();
      if (at === "adhd") adhd++;
      else if (at === "asd") asd++;
      else if (at === "sld") sld++;
      const se = !!r.sent_email;
      const ss = !!r.sent_sms;
      if (se && ss) emailSms++;
      else if (se && !ss) emailOnly++;
      else if (ss && !se) smsOnly++;
    }
    return { total, adhd, asd, sld, emailSms, emailOnly, smsOnly };
  }, [referralsRows, intelRangeBounds]);

  const referralIntelLastActivityLabel = useMemo(() => {
    const now = new Date();
    if (referralsRows.length === 0) return "No activity yet";
    let latest: Date | null = null;
    for (const row of referralsRows) {
      const ca = row.created_at;
      if (!ca || typeof ca !== "string") continue;
      const created = new Date(ca);
      if (Number.isNaN(created.getTime())) continue;
      if (!latest || created.getTime() > latest.getTime()) latest = created;
    }
    if (!latest) return "No activity yet";
    return formatReferralLastActivity(latest, now);
  }, [referralsRows]);

  const registerFilteredFull = useMemo(() => {
    const now = new Date();
    return sentRegister.filter((r) =>
      sentRegisterEntryInPeriod(r.at, registerPeriodFilter, now)
    );
  }, [sentRegister, registerPeriodFilter]);

  const registerDisplayed = useMemo(() => {
    if (registerShowAllHistory) return registerFilteredFull;
    return registerFilteredFull.slice(0, 10);
  }, [registerFilteredFull, registerShowAllHistory]);

  const copyText = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setSendStatus({ type: "success", message: `${label} copied.` });
    } catch {
      setSendStatus({
        type: "error",
        message: "Send failed: Clipboard unavailable.",
      });
    }
    setTimeout(() => setSendStatus(null), 2500);
  };

  const registerCsv = useMemo(() => {
    const headers = [
      "timestamp_iso",
      "channel",
      "child_first",
      "child_last",
      "child_dob",
      "parent_first",
      "parent_last",
      "parent_email",
      "parent_mobile",
      "assessment_type",
      "booking_link",
      "clinic_phone",
      "internal_notes",
      "referrer_name",
      "referrer_type",
      "referrer_email",
    ];
    const rows = sentRegister.map((r) =>
      [
        r.at,
        r.channel,
        r.childFirst,
        r.childLast,
        r.childDob,
        r.parentFirst,
        r.parentLast,
        r.parentEmail,
        r.parentMobile,
        r.assessmentType,
        r.bookingLink,
        r.clinicPhone,
        r.internalNotes,
        r.referrerName,
        r.referrerType,
        r.referrerEmail,
      ]
        .map((cell) => {
          const s = String(cell ?? "");
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(",")
    );
    return [headers.join(","), ...rows].join("\n");
  }, [sentRegister]);

  const downloadCsv = () => {
    const blob = new Blob([registerCsv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `azure-mind-sent-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setSendStatus({ type: "success", message: "CSV download started." });
    setTimeout(() => setSendStatus(null), 2500);
  };

  const clearForm = () => {
    setChildFirst("");
    setChildLast("");
    setChildDob("");
    setParentFirst("");
    setParentLast("");
    setParentEmail("");
    setParentMobile("");
    setAssessmentType("ADHD");
    setBookingLink(DEFAULT_BOOKING_LINK);
    setClinicPhone(DEFAULT_CLINIC_PHONE);
    setInternalNotes("");
    setReferrerName("");
    setReferrerType("");
    setReferrerEmail("");
    setPreviewEmailHtml("");
    setPreviewSms("");
    setPreviewReady(false);
    setSendStatus(null);
    scrollToTopAndFocus();
  };

  const sendAnotherReferral = () => {
    clearForm();
  };

  const pageBg =
    "linear-gradient(to bottom, #F7FBFB, #E8F6F5)";

  const shell: CSSProperties = {
    maxWidth: 1160,
    margin: "0 auto",
    padding: 24,
  };

  const headerBar: CSSProperties = {
    background: "linear-gradient(135deg, #0E5F63 0%, #129A93 100%)",
    color: "#fff",
    padding: "20px 24px",
    borderRadius: 16,
    boxShadow: "0 4px 14px rgba(14, 95, 99, 0.22)",
    marginBottom: 24,
  };

  const card: CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #B7E1DE",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.04)",
    marginBottom: 24,
  };

  const cardReferrer: CSSProperties = {
    background: "#F7FBFB",
    border: "1px dashed #B7E1DE",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.03)",
    marginBottom: 24,
    opacity: 0.98,
  };

  const sectionTitle: CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    color: "#075E63",
    marginBottom: 14,
  };

  const labelStyle: CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 700,
    color: "#075E63",
    marginBottom: 6,
    marginTop: 14,
  };

  const labelFirst: CSSProperties = {
    ...labelStyle,
    marginTop: 0,
  };

  const inputStyle: CSSProperties = {
    width: "100%",
    height: 44,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #A7D8D4",
    background: "#fff",
    fontSize: 14,
    boxSizing: "border-box",
  };

  const textareaStyle: CSSProperties = {
    ...inputStyle,
    height: "auto",
    minHeight: 100,
    resize: "vertical" as const,
  };

  const actionBtnBase: CSSProperties = {
    height: 44,
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    whiteSpace: "nowrap",
    cursor: "pointer",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 16px",
  };

  const btnPrimary: CSSProperties = {
    ...actionBtnBase,
    border: "none",
    background: "#0E9F98",
    color: "#fff",
    boxShadow: "0 6px 14px rgba(14, 159, 152, 0.22)",
  };

  const btnSecondary: CSSProperties = {
    ...actionBtnBase,
    background: "#E8F6F5",
    border: "1px solid #7CCBC6",
    color: "#075E63",
  };

  const btnDestructive: CSSProperties = {
    ...actionBtnBase,
    background: "#F3F4F6",
    border: "1px solid #D1D5DB",
    color: "#374151",
  };

  const sendStatusBannerSuccess: CSSProperties = {
    padding: "12px 14px",
    borderRadius: 10,
    fontWeight: 700,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 1.45,
    background: "#E6F7F4",
    border: "1px solid #57C7B8",
    color: "#075E63",
  };

  const sendStatusBannerError: CSSProperties = {
    padding: "12px 14px",
    borderRadius: 10,
    fontWeight: 700,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 1.45,
    background: "#FEF2F2",
    border: "1px solid #FCA5A5",
    color: "#991B1B",
  };

  const headerSignOutBtn: CSSProperties = {
    flexShrink: 0,
    alignSelf: "flex-start",
    marginTop: 2,
    padding: "8px 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.45)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    boxSizing: "border-box",
  };

  const referralIntelPanel: CSSProperties = {
    background: "#FFFFFF",
    border: "1px solid #B7E1DE",
    borderRadius: 16,
    padding: "14px 16px",
    marginBottom: 24,
    boxShadow: "0 4px 14px rgba(14, 95, 99, 0.06)",
  };

  const referralIntelPill: CSSProperties = {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid #7CCBC6",
    background: "#E8F6F5",
    color: "#075E63",
    boxSizing: "border-box",
  };

  const referralIntelPillActive: CSSProperties = {
    ...referralIntelPill,
    background: "#0E9F98",
    color: "#fff",
    border: "1px solid #0E9F98",
  };

  const registerFilterPill: CSSProperties = {
    ...referralIntelPill,
    padding: "5px 10px",
    fontSize: 11,
  };

  const registerFilterPillActive: CSSProperties = {
    ...referralIntelPillActive,
    padding: "5px 10px",
    fontSize: 11,
  };

  const registerExportBtn: CSSProperties = {
    ...btnSecondary,
    height: 32,
    fontSize: 12,
    padding: "0 12px",
    fontWeight: 700,
  };

  const referralIntelStatLabel: CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "#64748b",
    letterSpacing: "0.02em",
  };

  const referralIntelStatValue: CSSProperties = {
    fontSize: 18,
    fontWeight: 700,
    color: "#0E9F98",
    lineHeight: 1.2,
    marginTop: 2,
  };

  if (!unlocked) {
    return (
      <main
        className="azuremind-app"
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: pageBg,
          padding: 24,
        }}
      >
        <div style={{ ...shell, maxWidth: 420, width: "100%" }}>
          <header
            style={{
              ...headerBar,
              textAlign: "center",
              marginBottom: 24,
              boxShadow: "0 8px 28px rgba(14, 95, 99, 0.18)",
            }}
          >
            <h1
              style={{
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              Azure Mind
            </h1>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                opacity: 0.94,
                marginTop: 8,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Referral Engine
            </p>
            <p
              style={{
                fontSize: 12,
                fontWeight: 500,
                opacity: 0.72,
                marginTop: 10,
                letterSpacing: "0.02em",
              }}
            >
              Internal Use Only
            </p>
          </header>
          <form
            onSubmit={handleUnlock}
            style={{
              ...card,
              marginBottom: 0,
              boxShadow: "0 4px 24px rgba(15, 23, 42, 0.08)",
              border: "1px solid rgba(14, 95, 99, 0.08)",
            }}
          >
            <label style={labelFirst} htmlFor="sign-in-password">
              Password
            </label>
            <input
              id="sign-in-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                if (pinError) setPinError(null);
              }}
              placeholder="Enter password"
              aria-invalid={pinError ? true : undefined}
              style={{
                ...inputStyle,
                ...(pinError
                  ? {
                      border: "2px solid #DC2626",
                    }
                  : {}),
              }}
            />
            {pinError ? (
              <p
                style={{
                  color: "#991B1B",
                  fontSize: 13,
                  fontWeight: 600,
                  marginTop: 10,
                }}
              >
                {pinError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={signingIn}
              style={{
                ...btnPrimary,
                width: "100%",
                marginTop: 16,
                opacity: signingIn ? 0.85 : 1,
                cursor: signingIn ? "wait" : "pointer",
              }}
            >
              {signingIn ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div
      className="azuremind-app"
      style={{ minHeight: "100vh", background: pageBg }}
    >
      <div style={shell}>
        <header
          style={{
            ...headerBar,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Azure Mind
            </h1>
            <p style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>
              Referral Engine
            </p>
            <p style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>
              Internal Use Only
            </p>
          </div>
          <button type="button" style={headerSignOutBtn} onClick={signOut}>
            Sign out
          </button>
        </header>

        <section style={referralIntelPanel}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#075E63",
                  margin: 0,
                }}
              >
                Referral Intelligence
              </h2>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#94a3b8",
                  marginTop: 4,
                  marginBottom: 0,
                  lineHeight: 1.35,
                }}
              >
                Last activity: {referralIntelLastActivityLabel}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                style={
                  dateIntelFilter === "today"
                    ? referralIntelPillActive
                    : referralIntelPill
                }
                onClick={() => setDateIntelFilter("today")}
              >
                Today
              </button>
              <button
                type="button"
                style={
                  dateIntelFilter === "week"
                    ? referralIntelPillActive
                    : referralIntelPill
                }
                onClick={() => setDateIntelFilter("week")}
              >
                This Week
              </button>
              <button
                type="button"
                style={
                  dateIntelFilter === "month"
                    ? referralIntelPillActive
                    : referralIntelPill
                }
                onClick={() => setDateIntelFilter("month")}
              >
                This Month
              </button>
              <button
                type="button"
                style={
                  dateIntelFilter === "30d"
                    ? referralIntelPillActive
                    : referralIntelPill
                }
                onClick={() => setDateIntelFilter("30d")}
              >
                Last 30 Days
              </button>
              <button
                type="button"
                style={
                  dateIntelFilter === "custom"
                    ? referralIntelPillActive
                    : referralIntelPill
                }
                onClick={() => setDateIntelFilter("custom")}
              >
                Custom date range
              </button>
            </div>
          </div>
          {dateIntelFilter === "custom" ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
                marginTop: 10,
                width: "100%",
              }}
            >
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#075E63",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                From
                <input
                  type="date"
                  value={intelCustomFrom}
                  onChange={(e) => setIntelCustomFrom(e.target.value)}
                  style={{ ...inputStyle, width: "auto", minWidth: 132, height: 36 }}
                />
              </label>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#075E63",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                To
                <input
                  type="date"
                  value={intelCustomTo}
                  onChange={(e) => setIntelCustomTo(e.target.value)}
                  style={{ ...inputStyle, width: "auto", minWidth: 132, height: 36 }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const f = intelCustomFrom.trim();
                  const t = intelCustomTo.trim();
                  if (!f || !t) return;
                  setIntelCustomAppliedFrom(f);
                  setIntelCustomAppliedTo(t);
                }}
                style={{
                  ...btnPrimary,
                  height: 36,
                  fontSize: 12,
                  padding: "0 14px",
                }}
              >
                Apply Range
              </button>
              <button
                type="button"
                onClick={() => {
                  setIntelCustomFrom("");
                  setIntelCustomTo("");
                  setIntelCustomAppliedFrom("");
                  setIntelCustomAppliedTo("");
                  setDateIntelFilter("today");
                }}
                style={{
                  ...btnSecondary,
                  height: 36,
                  fontSize: 12,
                  padding: "0 14px",
                }}
              >
                Clear Range
              </button>
            </div>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "10px 14px",
              marginTop: 12,
            }}
          >
            <div>
              <div style={referralIntelStatLabel}>Total referrals</div>
              <div style={referralIntelStatValue}>
                {intelligenceStats.total}
              </div>
            </div>
            <div>
              <div style={referralIntelStatLabel}>ADHD</div>
              <div style={referralIntelStatValue}>{intelligenceStats.adhd}</div>
            </div>
            <div>
              <div style={referralIntelStatLabel}>ASD</div>
              <div style={referralIntelStatValue}>{intelligenceStats.asd}</div>
            </div>
            <div>
              <div style={referralIntelStatLabel}>SLD</div>
              <div style={referralIntelStatValue}>{intelligenceStats.sld}</div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "10px 14px",
              marginTop: 10,
            }}
          >
            <div>
              <div style={referralIntelStatLabel}>Email + SMS</div>
              <div style={referralIntelStatValue}>
                {intelligenceStats.emailSms}
              </div>
            </div>
            <div>
              <div style={referralIntelStatLabel}>Email only</div>
              <div style={referralIntelStatValue}>
                {intelligenceStats.emailOnly}
              </div>
            </div>
            <div>
              <div style={referralIntelStatLabel}>SMS only</div>
              <div style={referralIntelStatValue}>
                {intelligenceStats.smsOnly}
              </div>
            </div>
          </div>
        </section>

        <main className="referral-main-grid">
        <div
          className="referral-col-left"
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
        >
          <section style={card}>
            <h2 style={sectionTitle}>
              Referral details
            </h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelFirst} htmlFor="childFirst">
                  Child first name *
                </label>
                <input
                  ref={childFirstNameRef}
                  id="childFirst"
                  value={childFirst}
                  onChange={(e) => setChildFirst(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
  <label style={labelFirst} htmlFor="childLast">
    Child last name *
  </label>
  <input
    id="childLast"
    value={childLast}
    onChange={(e) => setChildLast(e.target.value)}
    style={inputStyle}
  />
</div>

<div>
  <label style={labelFirst} htmlFor="childDob">
    Child DOB *
  </label>
  <input
    type="date"
    id="childDob"
    value={childDob}
    onChange={(e) => setChildDob(e.target.value)}
    style={inputStyle}
  />
</div>
              <div>
                <label style={labelStyle} htmlFor="parentFirst">
                  Parent first name *
                </label>
                <input
                  id="parentFirst"
                  value={parentFirst}
                  onChange={(e) => setParentFirst(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="parentLast">
                  Parent last name *
                </label>
                <input
                  id="parentLast"
                  value={parentLast}
                  onChange={(e) => setParentLast(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="parentEmail">
                  Parent email <span style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <input
                  id="parentEmail"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="parentMobile">
                  Parent mobile *
                </label>
                <input
                  id="parentMobile"
                  type="tel"
                  value={parentMobile}
                  onChange={(e) => setParentMobile(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <span style={labelStyle}>Assessment type *</span>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  {(["ADHD", "ASD", "SLD"] as const).map((t) => (
                    <label
                      key={t}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#075E63",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="assessment"
                        checked={assessmentType === t}
                        onChange={() => setAssessmentType(t)}
                      />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle} htmlFor="bookingLink">
                  Booking link *{" "}
                  <span style={{ fontWeight: 400 }}>(default)</span>
                </label>
                <input
                  id="bookingLink"
                  type="url"
                  value={bookingLink}
                  onChange={(e) => setBookingLink(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="clinicPhone">
                  Clinic phone *{" "}
                  <span style={{ fontWeight: 400 }}>(default)</span>
                </label>
                <input
                  id="clinicPhone"
                  type="tel"
                  value={clinicPhone}
                  onChange={(e) => setClinicPhone(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="internalNotes">
                  Internal notes
                </label>
                <textarea
                  id="internalNotes"
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                  style={{ ...textareaStyle, fontFamily: "inherit" }}
                />
              </div>
            </div>
          </section>

          <section style={cardReferrer}>
            <h2 style={{ ...sectionTitle, marginBottom: 8 }}>
              Internal referrer
            </h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12 }}>
              Must never appear in parent-facing email or SMS.
            </p>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelFirst} htmlFor="referrerName">
                  Referrer name
                </label>
                <input
                  id="referrerName"
                  value={referrerName}
                  onChange={(e) => setReferrerName(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="referrerType">
                  Referrer type
                </label>
                <input
                  id="referrerType"
                  value={referrerType}
                  onChange={(e) => setReferrerType(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="referrerEmail">
                  Referrer email
                </label>
                <input
                  id="referrerEmail"
                  type="email"
                  value={referrerEmail}
                  onChange={(e) => setReferrerEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>
              Actions
            </h2>
            {sendStatus ? (
              <div
                role="status"
                style={
                  sendStatus.type === "success"
                    ? sendStatusBannerSuccess
                    : sendStatusBannerError
                }
              >
                {sendStatus.message}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  style={{ ...btnPrimary, width: "100%" }}
                  onClick={async () => {
                    if (!validateCoreFields()) return;
                    if (!parentEmail.trim()) {
                      setSendStatus({
                        type: "error",
                        message:
                          "Send failed: Parent email is required to send email. You can still send SMS only.",
                      });
                      setTimeout(() => setSendStatus(null), 4000);
                      return;
                    }
                    const emailOk = await sendEmailWithCurrentForm();
                    if (!emailOk) {
                      setSendStatus({
                        type: "error",
                        message: "Send failed: Email could not be sent.",
                      });
                      return;
                    }
                    const smsResult = await sendSmsWithCurrentForm();
                    if (smsResult.ok) {
                      setSendStatus({
                        type: "success",
                        message: "Email and SMS sent successfully.",
                      });
                      void fetch("/api/referrals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          child_first_name: childFirst,
                          child_last_name: childLast,
                          child_dob: childDob,
                          parent_first_name: parentFirst,
                          parent_last_name: parentLast,
                          parent_email: parentEmail,
                          parent_mobile: parentMobile,
                          assessment_type: assessmentType,
                          booking_link: bookingLink,
                          clinic_phone: clinicPhone,
                          sent_email: true,
                          sent_sms: true,
                          send_status: "email_sms_sent",
                        }),
                      })
                        .then(async (res) => {
                          let json: { success?: boolean } = {};
                          try {
                            json = (await res.json()) as { success?: boolean };
                          } catch {
                            /* ignore */
                          }
                          if (res.ok && json.success === true)
                            void loadReferrals();
                        })
                        .catch((error) => {
                          console.error("Failed to save referral:", error);
                        });
                    } else {
                      setSendStatus({
                        type: "error",
                        message: `Send failed: ${smsResult.error ?? "SMS could not be sent."}`,
                      });
                    }
                  }}
                >
                  Send Email + SMS
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={async () => {
                    if (!validateCoreFields()) return;
                    if (!parentEmail.trim()) {
                      setSendStatus({
                        type: "error",
                        message:
                          "Send failed: Parent email is required to send email. You can still send SMS only.",
                      });
                      setTimeout(() => setSendStatus(null), 4000);
                      return;
                    }
                    const ok = await sendEmailWithCurrentForm();
                    if (ok) {
                      setSendStatus({
                        type: "success",
                        message: "Email sent successfully.",
                      });
                      void fetch("/api/referrals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          child_first_name: childFirst,
                          child_last_name: childLast,
                          child_dob: childDob,
                          parent_first_name: parentFirst,
                          parent_last_name: parentLast,
                          parent_email: parentEmail,
                          parent_mobile: parentMobile,
                          assessment_type: assessmentType,
                          booking_link: bookingLink,
                          clinic_phone: clinicPhone,
                          sent_email: true,
                          sent_sms: false,
                          send_status: "email_sent",
                        }),
                      })
                        .then(async (res) => {
                          let json: { success?: boolean } = {};
                          try {
                            json = (await res.json()) as { success?: boolean };
                          } catch {
                            /* ignore */
                          }
                          if (res.ok && json.success === true)
                            void loadReferrals();
                        })
                        .catch((error) => {
                          console.error("Failed to save referral:", error);
                        });
                    } else {
                      setSendStatus({
                        type: "error",
                        message: "Send failed: Email could not be sent.",
                      });
                    }
                  }}
                >
                  Send Email Only
                </button>
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={async () => {
                    if (!validateCoreFields()) return;
                    const smsResult = await sendSmsWithCurrentForm();
                    if (smsResult.ok) {
                      setSendStatus({
                        type: "success",
                        message: "SMS sent successfully.",
                      });
                      void fetch("/api/referrals", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          child_first_name: childFirst,
                          child_last_name: childLast,
                          child_dob: childDob,
                          parent_first_name: parentFirst,
                          parent_last_name: parentLast,
                          parent_email: parentEmail,
                          parent_mobile: parentMobile,
                          assessment_type: assessmentType,
                          booking_link: bookingLink,
                          clinic_phone: clinicPhone,
                          sent_email: false,
                          sent_sms: true,
                          send_status: "sms_sent",
                        }),
                      })
                        .then(async (res) => {
                          let json: { success?: boolean } = {};
                          try {
                            json = (await res.json()) as { success?: boolean };
                          } catch {
                            /* ignore */
                          }
                          if (res.ok && json.success === true)
                            void loadReferrals();
                        })
                        .catch((error) => {
                          console.error("Failed to save referral:", error);
                        });
                    } else {
                      setSendStatus({
                        type: "error",
                        message: `Send failed: ${smsResult.error ?? "SMS could not be sent."}`,
                      });
                    }
                  }}
                >
                  Send SMS Only
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={() => {
                    if (!validateCoreFields()) return;
                    if (!previewReady) {
                      setSendStatus({
                        type: "error",
                        message: "Send failed: Preview is not ready yet.",
                      });
                      setTimeout(() => setSendStatus(null), 3000);
                      return;
                    }
                    copyText("Email HTML", previewEmailHtml);
                  }}
                >
                  Copy Email HTML
                </button>
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={() => {
                    if (!validateCoreFields()) return;
                    if (!previewReady) {
                      setSendStatus({
                        type: "error",
                        message: "Send failed: Preview is not ready yet.",
                      });
                      setTimeout(() => setSendStatus(null), 3000);
                      return;
                    }
                    copyText("SMS", previewSms);
                  }}
                >
                  Copy SMS
                </button>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  style={btnSecondary}
                  onClick={sendAnotherReferral}
                >
                  Send Another Referral
                </button>
                <button type="button" style={btnDestructive} onClick={clearForm}>
                  Clear Form
                </button>
              </div>
            </div>
          </section>
        </div>

        <div
          className="referral-col-right"
          style={{ display: "flex", flexDirection: "column", gap: 0 }}
        >
          <section style={card}>
            <h2 style={sectionTitle}>
              Email preview (parent-facing)
            </h2>
            {previewReady ? (
              <p className="email-preview-helper">
                Scroll inside the preview to review the full email.
              </p>
            ) : null}
            {!previewReady ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Click &quot;Generate Preview&quot; to build parent-facing content.
                Internal referrer fields are excluded.
              </p>
            ) : (
              <div className="email-preview-scroll">
              <EmailPreviewPlain
                childFirst={childFirst}
                childLast={childLast}
                childDob={childDob}
                parentFirst={parentFirst}
                parentLast={parentLast}
                parentEmail={parentEmail}
                parentMobile={parentMobile}
                assessmentType={assessmentType}
                bookingLink={bookingLink}
                clinicPhone={clinicPhone}
              />
              </div>
            )}
          </section>

          <section style={card}>
            <h2 style={sectionTitle}>
              SMS preview (parent-facing)
            </h2>
            {!previewReady ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                Generate preview to see SMS text.
              </p>
            ) : (
              <div className="sms-preview-shell">
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #B7E1DE",
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "inherit",
                }}
              >
                {previewSms}
              </pre>
              </div>
            )}
          </section>

          <section style={card}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <h2 style={{ ...sectionTitle, marginBottom: 0 }}>
                Sent register ({sentRegister.length})
              </h2>
              <button
                type="button"
                style={{
                  ...registerExportBtn,
                  opacity: sentRegister.length === 0 ? 0.45 : 1,
                }}
                onClick={downloadCsv}
                disabled={sentRegister.length === 0}
              >
                Download CSV
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  style={
                    registerPeriodFilter === "today"
                      ? registerFilterPillActive
                      : registerFilterPill
                  }
                  onClick={() => setRegisterPeriodFilter("today")}
                >
                  Today
                </button>
                <button
                  type="button"
                  style={
                    registerPeriodFilter === "week"
                      ? registerFilterPillActive
                      : registerFilterPill
                  }
                  onClick={() => setRegisterPeriodFilter("week")}
                >
                  This Week
                </button>
                <button
                  type="button"
                  style={
                    registerPeriodFilter === "month"
                      ? registerFilterPillActive
                      : registerFilterPill
                  }
                  onClick={() => setRegisterPeriodFilter("month")}
                >
                  This Month
                </button>
                <button
                  type="button"
                  style={
                    registerPeriodFilter === "all"
                      ? registerFilterPillActive
                      : registerFilterPill
                  }
                  onClick={() => setRegisterPeriodFilter("all")}
                >
                  All
                </button>
              </div>
              <button
                type="button"
                style={
                  registerShowAllHistory
                    ? registerFilterPillActive
                    : registerFilterPill
                }
                onClick={() => setRegisterShowAllHistory((v) => !v)}
                disabled={sentRegister.length === 0}
              >
                {registerShowAllHistory
                  ? "Show recent only"
                  : "Show all history"}
              </button>
            </div>
            {sentRegister.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 0 }}>
                No entries yet. Use send placeholders or actions that record to the
                register.
              </p>
            ) : registerFilteredFull.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b", marginTop: 0 }}>
                No referrals found for this period.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  maxHeight: registerShowAllHistory ? 320 : 220,
                  overflow: "auto",
                  padding: 0,
                  margin: 0,
                  marginTop: 2,
                }}
              >
                {registerDisplayed.map((r) => {
                  const childDisplay =
                    [r.childFirst, r.childLast]
                      .map((s) => (s || "").trim())
                      .filter(Boolean)
                      .join(" ") || "(child)";
                  const parentDisplay = [r.parentFirst, r.parentLast]
                    .map((s) => (s || "").trim())
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <li
                      key={r.id}
                      style={{
                        padding: "8px 0",
                        borderBottom: "1px solid #B7E1DE",
                        lineHeight: 1.35,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#075E63",
                        }}
                      >
                        {childDisplay} — {r.assessmentType} —{" "}
                        <span style={{ color: "#0E9F98" }}>{r.channel}</span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "#94a3b8",
                          marginTop: 3,
                          fontWeight: 500,
                        }}
                      >
                        {parentDisplay || "—"} ·{" "}
                        {new Date(r.at).toLocaleString()}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
      </div>
    </div>
  );
}

const pathwayFaqCardHeaderStyle: CSSProperties = {
  background: "#0E5F63",
  color: "#fff",
  padding: "12px 14px",
  fontWeight: 700,
  borderRadius: "8px 8px 0 0",
};

const pathwayFaqCardBodyStyle: CSSProperties = {
  border: "1px solid #D9E5E5",
  borderTop: "none",
  padding: 14,
  background: "#F8FBFB",
  borderRadius: "0 0 8px 8px",
  fontSize: 14,
  color: "#2c4a4c",
  lineHeight: 1.65,
  whiteSpace: "pre-line",
};

function PathwayFaqCardsReact({ rows }: { rows: { q: string; a: string }[] }) {
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} style={{ margin: "16px 0" }}>
          <div style={pathwayFaqCardHeaderStyle}>{row.q}</div>
          <div style={pathwayFaqCardBodyStyle}>{row.a}</div>
        </div>
      ))}
    </>
  );
}

function SldStyledFaqReact({ clinicPhone }: { clinicPhone: string }) {
  return (
    <PathwayFaqCardsReact
      rows={[
        {
          q: "Is this a diagnostic assessment?",
          a: "Yes. This is a Learning Diagnostic Assessment. It investigates whether your child meets criteria for a Specific Learning Disorder and provides a written Report outlining findings and recommendations.",
        },
        {
          q: "Is this the same as dyslexia, dysgraphia, or dyscalculia?",
          a: "Specific Learning Disorder is the formal diagnostic term. It can include difficulties in reading, written expression, spelling, or mathematics.",
        },
        {
          q: "Will the Report help with school support?",
          a: "Yes. The Report is structured to support school planning, learning adjustments, and recommendations for classroom and assessment support where relevant.",
        },
        {
          q: "Is online testing appropriate for learning assessments?",
          a: "The Assessment uses Pearson\u2019s secure Digital WIAT platform and is administered in a structured manner via Video Telehealth. The testing process remains standardised and guided throughout the session.",
        },
        {
          q: "What if my child does not meet criteria for SLD?",
          a: "The Report will outline the most likely explanation for your child\u2019s learning profile and provide practical recommendations for next steps.",
        },
        {
          q: "Are there any rebates available?",
          a: "Private health rebates may apply to the Psychological Assessment component, depending on your level of cover.",
        },
        {
          q: "Can we reschedule or cancel an appointment?",
          a: `Yes. We require at least 48 hours\u2019 notice. Please call or text ${clinicPhone} to make changes.`,
        },
      ]}
    />
  );
}

function AdhdStyledFaqReact({ clinicPhone }: { clinicPhone: string }) {
  return (
    <PathwayFaqCardsReact
      rows={[
        {
          q: "Is this a diagnosis or just an assessment?",
          a: "This is a Diagnostic Assessment. Psychologists are trained to assess and diagnose ADHD, and the outcome is clearly outlined in the Report.",
        },
        {
          q: "What if ADHD is not identified?",
          a: "The Report will outline the most likely explanation for your child\u2019s presentation and provide clear, practical recommendations for next steps.",
        },
        {
          q: "Do we need a GP referral?",
          a: "Yes. A GP referral is required to see Dr Murugesh Nidyananda. This can be arranged following your Assessment if needed.\n\nFor GP referrals:\nHealthLink (preferred): sageclin\nFax: (08) 6288 1663\nEmail: referrals@sageclinic.com.au",
        },
        {
          q: "Why might we need to see a Psychiatrist?",
          a: "Where medication is identified as a clinical need, Medical Review is required. In Australia, medication is typically a first-line treatment for ADHD and must be prescribed and managed by a Paediatrician or Psychiatrist.",
        },
        {
          q: "Are there any rebates available?",
          a: "Private health rebates may apply to the Psychological Assessment, depending on your level of cover.",
        },
        {
          q: "Can we reschedule or cancel an appointment?",
          a: `Yes. We require at least 48 hours\u2019 notice for rescheduling or cancellations. Please call or text ${clinicPhone} to make changes to your appointment.`,
        },
      ]}
    />
  );
}

function AsdStyledFaqReact({ clinicPhone }: { clinicPhone: string }) {
  return (
    <PathwayFaqCardsReact
      rows={[
        {
          q: "Is this a formal Autism diagnosis?",
          a: "This is a structured Diagnostic Assessment completed using a Consensus Pathway aligned with national guidelines. Diagnostic Confirmation is provided through the combined Psychological and Medical Assessment process where required.",
        },
        {
          q: "Why is a Paediatrician or Psychiatrist involved?",
          a: "Autism assessments can be completed using different combinations of professionals. The Consensus Assessment Pathway combines Psychological Assessment with Medical Review within a single, coordinated process.\n\nThis ensures that both developmental and medical considerations are addressed where relevant, rather than being separated across different services.",
        },
        {
          q: "Do we need to complete both stages?",
          a: "Not always. Stage 1 provides a clear clinical position. Where Diagnostic Confirmation is required, Stage 2 completes the Consensus process.",
        },
        {
          q: "Will this be suitable for NDIS or school support?",
          a: "Where Autism is identified, documentation from the Assessment Pathway can be used to support applications and planning for services such as NDIS, where applicable.",
        },
        {
          q: "What if my child does not meet Autism diagnosis?",
          a: "The Report will outline the most likely explanation for your child\u2019s presentation and provide clear, practical recommendations for next steps.",
        },
        {
          q: "Are there any rebates available?",
          a: "Private health rebates may apply to the Psychological Assessment component, depending on your level of cover.",
        },
        {
          q: "Can we reschedule or cancel an appointment?",
          a: `Yes. We require at least 48 hours\u2019 notice for rescheduling or cancellations. Please call or text ${clinicPhone} to make changes to your appointment.`,
        },
      ]}
    />
  );
}

function parsePlainEmailBodyToReact(
  plain: string,
  bookingLink: string,
  clinicPhone?: string
): ReactNode {
  const lines = plain.split("\n");
  const out: ReactNode[] = [];
  let inList = false;
  let listItems: ReactNode[] = [];
  let el = 0;
  const nextKey = () => {
    el += 1;
    return `ev-${el}`;
  };

  const flushList = () => {
    if (inList) {
      out.push(
        <ul
          key={nextKey()}
          style={{
            margin: "6px 0 6px 0",
            paddingLeft: 0,
            listStyle: "none",
          }}
        >
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "[SLD_STYLED_FAQ]") {
      flushList();
      out.push(
        <SldStyledFaqReact
          key={`sld-faq-${i}`}
          clinicPhone={clinicPhone ?? ""}
        />
      );
      continue;
    }

    if (line.trim() === "[ADHD_STYLED_FAQ]") {
      flushList();
      out.push(
        <AdhdStyledFaqReact
          key={`adhd-faq-${i}`}
          clinicPhone={clinicPhone ?? ""}
        />
      );
      continue;
    }

    if (line.trim() === "[ASD_STYLED_FAQ]") {
      flushList();
      out.push(
        <AsdStyledFaqReact
          key={`asd-faq-${i}`}
          clinicPhone={clinicPhone ?? ""}
        />
      );
      continue;
    }

    if (line.trim() === "[CTA_BUTTON]") {
      flushList();
      const href = bookingLink || "#";
      out.push(
        <div
          key={nextKey()}
          style={{ textAlign: "center", margin: "26px 0 8px" }}
        >
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              background: "#0E5F63",
              color: "#fff",
              textDecoration: "none",
              fontSize: 15,
              fontWeight: 700,
              padding: "15px 38px",
              borderRadius: 10,
              letterSpacing: -0.2,
            }}
          >
            Book Online
          </a>
        </div>
      );
      continue;
    }

    if (
      line.trim().length > 3 &&
      !line.startsWith("\u2022") &&
      /^[A-Z0-9\s\u2013\u2014&\/\-\(\)\.\+]+$/.test(line.trim())
    ) {
      flushList();
      out.push(
        <h3
          key={nextKey()}
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
            color: "#0E5F63",
            margin: "24px 0 8px",
            paddingBottom: 6,
            borderBottom: "1px solid #E3F0F1",
          }}
        >
          {line}
        </h3>
      );
      continue;
    }

    if (line.startsWith("\u2022")) {
      if (!inList) {
        inList = true;
        listItems = [];
      }
      listItems.push(
        <li
          key={`${i}-${line.slice(0, 24)}`}
          style={{
            padding: "3px 0 3px 18px",
            position: "relative",
            fontSize: 14,
            color: "#2c4a4c",
            lineHeight: 1.65,
          }}
        >
          <span style={{ position: "absolute", left: 2, color: "#2A8F94" }}>
            {"\u2022"}
          </span>
          {line.slice(1).trim()}
        </li>
      );
      continue;
    }

    if (line.trim() === "") {
      flushList();
      out.push(<div key={nextKey()} style={{ height: 8 }} />);
      continue;
    }

    flushList();
    out.push(
      <p
        key={nextKey()}
        style={{
          margin: "0 0 4px",
          fontSize: 14,
          color: "#2c4a4c",
          lineHeight: 1.7,
        }}
      >
        {line}
      </p>
    );
  }
  flushList();
  return <>{out}</>;
}

function EmailPreviewPlain({
  childFirst,
  childLast,
  childDob,
  parentFirst,
  parentLast,
  parentEmail,
  parentMobile,
  assessmentType,
  bookingLink,
  clinicPhone,
}: {
  childFirst: string;
  childLast: string;
  childDob: string;
  parentFirst: string;
  parentLast: string;
  parentEmail: string;
  parentMobile: string;
  assessmentType: AssessmentType;
  bookingLink: string;
  clinicPhone: string;
}) {
  const template = TEMPLATES[assessmentType];
  const data = toTemplateData({
    childFirst,
    childLast,
    childDob,
    parentFirst,
    parentLast,
    parentEmail,
    parentMobile,
    assessmentType,
    bookingLink,
    clinicPhone,
  });
  const renderedPlain = renderTemplate(template.email_body_plain, data);
  const bodyContent = parsePlainEmailBodyToReact(
    renderedPlain,
    data.booking_link,
    data.clinic_phone
  );

  return (
    <div
      style={{
        padding: 12,
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #B7E1DE",
        overflow: "auto",
      }}
    >
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{
          background: "#F4F7F7",
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
        }}
      >
        <tbody>
          <tr>
            <td
              align="center"
              style={{ padding: "28px 12px 40px", background: "#F4F7F7" }}
            >
              <table
                width="100%"
                style={{ maxWidth: 580 }}
                cellPadding={0}
                cellSpacing={0}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        background: "#0E5F63",
                        borderRadius: "12px 12px 0 0",
                        padding: "26px 32px",
                      }}
                    >
                      <div
                        style={{
                          display: "inline-block",
                          background: "rgba(255,255,255,0.15)",
                          borderRadius: 8,
                          padding: "6px 16px",
                          fontSize: 22,
                          fontWeight: 800,
                          color: "#fff",
                          letterSpacing: -0.5,
                        }}
                      >
                        Azure Mind
                      </div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.68)",
                          fontSize: 12,
                          marginTop: 6,
                        }}
                      >
                        Psychology &amp; Assessment
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        background: "#0A474A",
                        padding: "14px 32px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#fff",
                        }}
                      >
                        {template.email_title}
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        background: "#fff",
                        padding: "32px 32px 28px",
                        borderLeft: "1px solid #D9E5E5",
                        borderRight: "1px solid #D9E5E5",
                      }}
                    >
                      {bodyContent}
                    </td>
                  </tr>
                  <tr>
                    <td
                      style={{
                        background: "#F8FBFB",
                        border: "1px solid #D9E5E5",
                        borderTop: "none",
                        borderRadius: "0 0 12px 12px",
                        padding: "18px 32px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          color: "#647477",
                          lineHeight: 1.65,
                          margin: 0,
                        }}
                      >
                        Azure Mind Psychology | Perth, Western Australia
                        <br />
                        Vishal Maharaj is a Registered Psychologist registered
                        with AHPRA.
                        <br />
                        This communication contains general information about our
                        assessment services and is not clinical advice.
                        <br />
                        For assistance, contact us at{" "}
                        <strong style={{ color: "#0E5F63" }}>
                          {data.clinic_phone}
                        </strong>
                        .
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
