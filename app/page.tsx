"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignOutButton } from "@/components/SignOutButton";
import type { ReferralReaderExtract } from "@/lib/referral-reader/types";
import {
  buildParentBookingEmailHtml,
  DEFAULT_CLINIKO_BOOKINGS,
  getParentBookingSms,
  getParentBookingSubject,
} from "@/lib/referral-comms/parent-booking-email";

const DEFAULT_BOOKING_LINK = DEFAULT_CLINIKO_BOOKINGS;
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
  follow_up_stage?: number | null;
  next_follow_up_at?: string | null;
  status?: string | null;
  opted_out?: boolean | null;
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

function sentChannelLabel(channel: SentChannel): string {
  if (channel === "email+sms") return "email and text";
  if (channel === "sms") return "text";
  return "email";
}

function groupSentByMonth(rows: SentEntry[]): { key: string; label: string; rows: SentEntry[] }[] {
  const indexed = rows.map((row, index) => ({ row, index }));
  indexed.sort((a, b) => {
    const diff = new Date(b.row.at).getTime() - new Date(a.row.at).getTime();
    if (Number.isFinite(diff) && diff !== 0) return diff;
    return a.index - b.index;
  });
  const groups: { key: string; label: string; rows: SentEntry[] }[] = [];
  for (const { row } of indexed) {
    const date = new Date(row.at);
    const valid = !Number.isNaN(date.getTime());
    const key = valid
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      : `unknown:${row.at}`;
    const label = valid
      ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
      : row.at;
    const last = groups[groups.length - 1];
    if (!last || last.key !== key) groups.push({ key, label, rows: [row] });
    else last.rows.push(row);
  }
  return groups;
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
  referrerName?: string;
}): string {
  return buildParentBookingEmailHtml({
    childFirst: fields.childFirst,
    parentFirst: fields.parentFirst,
    referrerName: fields.referrerName,
    assessmentType: fields.assessmentType,
    bookingLink: fields.bookingLink,
    clinicPhone: fields.clinicPhone,
  });
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
  referrerName?: string;
}): string {
  return getParentBookingSms({
    childFirst: fields.childFirst,
    parentFirst: fields.parentFirst,
    referrerName: fields.referrerName,
    assessmentType: fields.assessmentType,
    bookingLink: fields.bookingLink,
    clinicPhone: fields.clinicPhone,
  });
}


export default function Home() {
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

  const [letterOpen, setLetterOpen] = useState(false);
  const [section, setSection] = useState<"upload" | "patient" | "assessment" | "communication">("upload");
  const [monthOpen, setMonthOpen] = useState<Record<string, boolean>>({});
  const [pathwaySet, setPathwaySet] = useState(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [readWarnings, setReadWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [showSent, setShowSent] = useState(false);
  const [letterFace, setLetterFace] = useState<"email" | "text">("email");
  const [sending, setSending] = useState(false);

  const childFirstNameRef = useRef<HTMLInputElement>(null);
  const dropFileRef = useRef<HTMLInputElement>(null);

  function scrollToTopAndFocus() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => childFirstNameRef.current?.focus(), 250);
  }

  const validateCoreFields = useCallback((): boolean => {
    if (
      !pathwaySet ||
      !childFirst.trim() ||
      !childLast.trim() ||
      !childDob.trim() ||
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
    pathwaySet,
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
      referrerName,
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
    referrerName,
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
      referrerName,
    };
    const subject = getParentBookingSubject({
      childFirst: fields.childFirst,
      parentFirst: fields.parentFirst,
      referrerName,
      assessmentType: fields.assessmentType,
      bookingLink: fields.bookingLink,
      clinicPhone: fields.clinicPhone,
    });

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
          purpose: "referral",
          to: parentEmail,
          subject,
          html: currentEmailHtml,
          replyTo: "admin@azuremind.com.au",
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
    referrerName,
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
      referrerName,
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
    referrerName,
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
        setSentRegister([]);
        return;
      }
      const rows = json.data as ReferralApiRow[];
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
      setSentRegister([]);
    }
  }, []);

  useEffect(() => {
    void loadReferrals();
  }, [loadReferrals]);

  useEffect(() => {
    const openUpload = () => {
      setShowSent(false);
      setSection("upload");
    };
    window.addEventListener("texlex-open-referral-upload", openUpload);
    return () => window.removeEventListener("texlex-open-referral-upload", openUpload);
  }, []);

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
    setPathwaySet(false);
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
    setLetterOpen(false);
    setMoreOpen(false);
    setPasteOpen(false);
    setPasteDraft("");
    setReadError(null);
    setReadWarnings([]);
    setLetterFace("email");
    setShowSent(false);
    setSection("upload");
    scrollToTopAndFocus();
  };

  const sendAnotherReferral = () => {
    clearForm();
  };

  const applyExtract = useCallback(
    (extract: ReferralReaderExtract) => {
      const resolvedType: AssessmentType =
        extract.assessmentType === "ADHD" ||
        extract.assessmentType === "ASD" ||
        extract.assessmentType === "SLD"
          ? extract.assessmentType
          : "ADHD";
      setChildFirst(extract.childFirst || "");
      setChildLast(extract.childLast || "");
      setChildDob(extract.childDob || "");
      setParentFirst(extract.parentFirst || "");
      setParentLast(extract.parentLast || "");
      setParentEmail(extract.parentEmail || "");
      setParentMobile(extract.parentMobile || "");
      setAssessmentType(resolvedType);
      setPathwaySet(
        extract.assessmentType === "ADHD" ||
          extract.assessmentType === "ASD" ||
          extract.assessmentType === "SLD"
      );
      setReferrerName(extract.referrerName || "");
      setReferrerType(extract.referrerType || "");
      setReferrerEmail(extract.referrerEmail || "");
      setInternalNotes(extract.internalNotes || "");
      const fields = {
        childFirst: extract.childFirst || "",
        childLast: extract.childLast || "",
        childDob: extract.childDob || "",
        parentFirst: extract.parentFirst || "",
        parentLast: extract.parentLast || "",
        parentEmail: extract.parentEmail || "",
        parentMobile: extract.parentMobile || "",
        assessmentType: resolvedType,
        bookingLink,
        clinicPhone,
        referrerName: extract.referrerName || "",
      };
      setPreviewEmailHtml(buildParentEmailHtml(fields));
      setPreviewSms(buildSmsText(fields));
      setPreviewReady(true);
      setReadWarnings(extract.warnings.filter(Boolean));
      setReadError(null);
      setSendStatus(null);
      setLetterFace("email");
      setPasteOpen(false);
      setMoreOpen(false);
      setShowSent(false);
      setLetterOpen(true);
      setSection("patient");
    },
    [bookingLink, clinicPhone]
  );

  const readReferral = useCallback(
    async (source: { file?: File | null; text?: string }) => {
      setReading(true);
      setReadError(null);
      setReadWarnings([]);
      setLetterOpen(false);
      setShowSent(false);
      setSection("upload");
      setDragOver(false);
      try {
        const form = new FormData();
        if (source.file) form.set("file", source.file);
        else if (source.text?.trim()) form.set("text", source.text);
        else {
          setReadError("Drop a referral PDF, or paste the letter.");
          return;
        }
        const res = await fetch("/api/referral-reader", { method: "POST", body: form });
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
          extract?: ReferralReaderExtract;
        };
        if (!res.ok || data.success !== true || !data.extract) {
          setReadError(data.error || "Could not read that referral.");
          return;
        }
        applyExtract(data.extract);
      } catch (e) {
        setReadError(e instanceof Error ? e.message : "Could not read that referral.");
      } finally {
        setReading(false);
      }
    },
    [applyExtract]
  );

  const recordReferral = useCallback(
    (sentEmail: boolean, sentSms: boolean, status: string) => {
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
          sent_email: sentEmail,
          sent_sms: sentSms,
          send_status: status,
        }),
      })
        .then(async (res) => {
          let json: { success?: boolean } = {};
          try {
            json = (await res.json()) as { success?: boolean };
          } catch {
            /* ignore */
          }
          if (res.ok && json.success === true) void loadReferrals();
        })
        .catch((error) => {
          console.error("Failed to save referral:", error);
        });
    },
    [
      assessmentType,
      bookingLink,
      childDob,
      childFirst,
      childLast,
      clinicPhone,
      loadReferrals,
      parentEmail,
      parentFirst,
      parentLast,
      parentMobile,
    ]
  );

  const sendToParent = useCallback(async () => {
    if (sending) return;
    if (!pathwaySet || !validateCoreFields()) return;
    setSending(true);
    setSendStatus(null);
    try {
      if (parentEmail.trim()) {
        const emailOk = await sendEmailWithCurrentForm();
        if (!emailOk) {
          setSendStatus({ type: "error", message: "The email could not be sent." });
          return;
        }
        const smsResult = await sendSmsWithCurrentForm();
        if (!smsResult.ok) {
          recordReferral(true, false, "email_sent");
          setSendStatus({
            type: "error",
            message: "The email was sent. The text could not be sent.",
          });
          return;
        }
        recordReferral(true, true, "email_sms_sent");
        setSendStatus({ type: "success", message: "Sent." });
        return;
      }
      const smsResult = await sendSmsWithCurrentForm();
      if (!smsResult.ok) {
        setSendStatus({
          type: "error",
          message: smsResult.error ?? "The text could not be sent.",
        });
        return;
      }
      recordReferral(false, true, "sms_sent");
      setSendStatus({ type: "success", message: "Text sent." });
    } finally {
      setSending(false);
    }
  }, [
    parentEmail,
    pathwaySet,
    recordReferral,
    sendEmailWithCurrentForm,
    sendSmsWithCurrentForm,
    sending,
    validateCoreFields,
  ]);

  const needLine = !childFirst.trim()
    ? "Need the child's first name"
    : !childLast.trim()
      ? "Need the child's last name"
      : !childDob.trim()
        ? "Need the date of birth"
        : !parentMobile.trim()
          ? "Need the parent's mobile"
          : !pathwaySet
            ? "Choose ADHD, ASD, or SLD"
            : null;

  const readyToSend = needLine === null;
  const sendLabel = sending
    ? "Sending"
    : parentEmail.trim()
      ? "Send email and text"
      : "Send text";

  const sentMonths = useMemo(() => groupSentByMonth(sentRegister), [sentRegister]);
  const sections = ["upload", "patient", "assessment", "communication"] as const;
  const sectionIndex = sections.indexOf(section);

  const fieldLabel: CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "#9eb2c6",
  };
  const fieldInput: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    borderBottom: "1px solid #34495c",
    background: "transparent",
    color: "#edf3f8",
    font: "inherit",
    fontSize: 18,
    fontWeight: 500,
    padding: "4px 0 8px",
  };
  const hintStyle: CSSProperties = {
    margin: "6px 0 0",
    minHeight: 18,
    fontSize: 14,
    color: "#f0b4b4",
  };

  function missingMessage(kind: "first" | "last" | "dob" | "mobile" | "pathway") {
    const text =
      kind === "first"
        ? "Need the child's first name"
        : kind === "last"
          ? "Need the child's last name"
          : kind === "dob"
            ? "Need the date of birth"
            : kind === "mobile"
              ? "Need the parent's mobile"
              : "Choose ADHD, ASD, or SLD";
    return needLine === text ? text : null;
  }

  return (
    <div
      className="referral-desk texlex-surface"
        style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        background: "#102033",
        color: "#edf3f8",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "var(--font-geist-sans), Inter, ui-sans-serif, system-ui, sans-serif",
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files?.length) return;
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        void readReferral({ file });
      }}
    >
      <nav className="referral-local-nav" aria-label="Referral">
        <button
          type="button"
          className="referral-nav-btn referral-nav-identity"
          onClick={() => {
            setShowSent(false);
            setSection("upload");
          }}
        >
          Referral
        </button>
        <div className="referral-nav-links">
          {showSent
            ? null
            : sections.map((item) => (
                <button
                  key={item}
                  type="button"
                  className="referral-nav-btn"
                  aria-current={section === item ? "page" : undefined}
                  onClick={() => {
                    setShowSent(false);
                    setSection(item);
                  }}
                >
                  {item === "upload"
                    ? "Upload referral"
                    : item === "patient"
                      ? "Patient details"
                      : item === "assessment"
                        ? "Assessment"
                        : "Communication"}
                </button>
              ))}
        </div>
        <div className="referral-nav-end">
          <button
            type="button"
            className="referral-nav-btn"
            aria-current={showSent ? "page" : undefined}
            onClick={() => setShowSent(true)}
          >
            Sent
          </button>
          {showSent ? (
            <button
              type="button"
              className="referral-text-btn"
              disabled={sentRegister.length === 0}
              onClick={downloadCsv}
            >
              Download
            </button>
          ) : null}
          <SignOutButton className="referral-text-btn" />
        </div>
        <input
          ref={dropFileRef}
          type="file"
          accept="application/pdf,.pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void readReferral({ file });
          }}
        />
      </nav>

      <div className="referral-stage">
        {showSent ? (
          <div className="referral-sheet">
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em" }}>Sent referrals</h1>
            <p style={{ margin: "8px 0 18px", fontSize: 15, color: "#cad7e3" }}>
              Communication history, organised by month.
            </p>
            {sendStatus ? (
              <p style={{ margin: "0 0 12px", fontSize: 15, color: sendStatus.type === "error" ? "#f0b4b4" : "#9bd6be" }}>
                {sendStatus.message}
              </p>
            ) : null}
            {sentRegister.length === 0 ? (
              <p style={{ fontSize: 16, color: "#cad7e3" }}>Nothing sent yet.</p>
            ) : (
              sentMonths.map((month, index) => {
                const open = Object.prototype.hasOwnProperty.call(monthOpen, month.key)
                  ? monthOpen[month.key]
                  : index === 0;
                return (
                  <section key={month.key}>
                    <button
                      type="button"
                      className="referral-month"
                      aria-expanded={open}
                      aria-label={`${month.label}, ${month.rows.length} sent`}
                      onClick={() =>
                        setMonthOpen((current) => ({
                          ...current,
                          [month.key]: !open,
                        }))
                      }
                    >
                      <span aria-hidden="true" style={{ width: 14, color: "#a8cdc4" }}>
                        {open ? "⌄" : "›"}
                      </span>
                      <span style={{ flex: 1 }}>{month.label}</span>
                      <span style={{ color: "#9eb2c6", fontWeight: 500, fontSize: 14 }}>
                        {month.rows.length} sent
                      </span>
                    </button>
                    {open ? (
                      <div style={{ padding: "0 0 8px 24px" }}>
                        <div className="referral-sent-head">
                          <span>Patient</span>
                          <span>Assessment</span>
                          <span>Method</span>
                          <span>Date and time</span>
                        </div>
                        {month.rows.map((row) => {
                          const child = [row.childFirst, row.childLast].filter(Boolean).join(" ") || "Unnamed";
                          return (
                            <div className="referral-sent-row" key={row.id}>
                              <span>{child}</span>
                              <span>{row.assessmentType}</span>
                              <span>{sentChannelLabel(row.channel)}</span>
                              <span>{new Date(row.at).toLocaleString()}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })
            )}
          </div>
        ) : section === "upload" ? (
          <div className="referral-sheet referral-upload">
            <div className="referral-upload-group">
              <h1 style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em" }}>Upload the referral</h1>
              <p style={{ margin: "8px 0 0", fontSize: 16, color: "#cad7e3" }}>
                Upload a referral PDF to automatically extract the patient and assessment details.
              </p>
              {reading ? (
                <>
                  <h2 style={{ margin: "18px 0 0", fontSize: 22, fontWeight: 500 }}>Reading the referral</h2>
                  <p style={{ margin: "8px 0 0", fontSize: 16, color: "#cad7e3" }}>The details will appear in Patient details.</p>
                </>
              ) : pasteOpen ? (
                <div style={{ width: "100%", marginTop: 16 }}>
                  <textarea
                    value={pasteDraft}
                    onChange={(e) => setPasteDraft(e.target.value)}
                    placeholder="Paste the referral"
                    rows={8}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "transparent",
                      color: "#edf3f8",
                      border: "none",
                      borderBottom: "1px solid #34495c",
                      font: "inherit",
                      fontSize: 16,
                      lineHeight: 1.45,
                      resize: "vertical",
                      padding: "8px 0",
                    }}
                  />
                  <div style={{ display: "flex", gap: 22, marginTop: 14 }}>
                    <button
                      type="button"
                      className="referral-text-btn"
                      style={{ color: "#edf3f8", textDecoration: "underline", textUnderlineOffset: 4 }}
                      onClick={() => void readReferral({ text: pasteDraft })}
                    >
                      Read the letter
                    </button>
                    <button type="button" className="referral-text-btn" onClick={() => setPasteOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="referral-drop"
                    onClick={() => dropFileRef.current?.click()}
                    style={dragOver ? { borderColor: "#a8cdc4", background: "#16304a" } : undefined}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#cad7e3" strokeWidth="1.6">
                      <path d="M12 16V5" />
                      <path d="M8 8l4-4 4 4" />
                      <path d="M5 19h14" />
                    </svg>
                    <strong>Drop a referral PDF here</strong>
                    <span>or select a file</span>
                  </button>
                  <p className="referral-upload-or">Other ways in</p>
                  <div className="referral-upload-alt">
                    <button type="button" className="referral-text-btn" onClick={() => setPasteOpen(true)}>
                      Paste referral
                    </button>
                    <button
                      type="button"
                      className="referral-text-btn"
                      onClick={() => {
                        setLetterOpen(true);
                        setShowSent(false);
                        setPathwaySet(false);
                        setSection("patient");
                      }}
                    >
                      Type details
                    </button>
                  </div>
                </>
              )}
              {readError ? (
                <p role="alert" style={{ color: "#f0b4b4", fontSize: 15, marginTop: 16 }}>{readError}</p>
              ) : null}
            </div>
          </div>
        ) : section === "patient" ? (
          <div className="referral-sheet">
            <h1 style={{ margin: "0 0 22px", fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em" }}>Patient details</h1>
            <div className="referral-field-row">
              <div>
                <label style={fieldLabel} htmlFor="desk-first">First name</label>
                <input
                  id="desk-first"
                  ref={childFirstNameRef}
                  aria-label="Child first name"
                  value={childFirst}
                  onChange={(e) => {
                    setChildFirst(e.target.value);
                    setSendStatus(null);
                  }}
                  style={fieldInput}
                />
                <p style={hintStyle}>{missingMessage("first")}</p>
              </div>
              <div>
                <label style={fieldLabel} htmlFor="desk-last">Last name</label>
                <input
                  id="desk-last"
                  aria-label="Child last name"
                  value={childLast}
                  onChange={(e) => {
                    setChildLast(e.target.value);
                    setSendStatus(null);
                  }}
                  style={fieldInput}
                />
                <p style={hintStyle}>{missingMessage("last")}</p>
              </div>
            </div>
            <div className="referral-field-row" style={{ marginTop: 8 }}>
              <div>
                <label style={fieldLabel} htmlFor="desk-dob">Date of birth</label>
                <input
                  id="desk-dob"
                  type="date"
                  value={childDob}
                  onChange={(e) => {
                    setChildDob(e.target.value);
                    setSendStatus(null);
                  }}
                  style={fieldInput}
                />
                <p style={hintStyle}>{missingMessage("dob")}</p>
              </div>
              <div>
                <label style={fieldLabel} htmlFor="desk-mobile">Parent mobile</label>
                <input
                  id="desk-mobile"
                  type="tel"
                  inputMode="tel"
                  aria-label="Parent mobile"
                  value={parentMobile}
                  onChange={(e) => {
                    setParentMobile(e.target.value);
                    setSendStatus(null);
                  }}
                  style={fieldInput}
                />
                <p style={hintStyle}>{missingMessage("mobile")}</p>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <label style={fieldLabel} htmlFor="desk-parent-email">Parent email</label>
              <input
                id="desk-parent-email"
                type="email"
                aria-label="Parent email"
                value={parentEmail}
                onChange={(e) => {
                  setParentEmail(e.target.value);
                  setSendStatus(null);
                }}
                style={fieldInput}
              />
            </div>
            {readWarnings.length ? (
              <p style={{ margin: "12px 0 0", fontSize: 14, color: "#f0c593" }}>{readWarnings.join(" ")}</p>
            ) : null}
            <button
              type="button"
              className="referral-text-btn"
              aria-expanded={moreOpen}
              style={{ marginTop: 18 }}
              onClick={() => setMoreOpen((open) => !open)}
            >
              Additional details <span aria-hidden="true">{moreOpen ? "⌃" : "⌄"}</span>
            </button>
            {moreOpen ? (
              <div style={{ display: "grid", gap: 8, maxWidth: 720, paddingBottom: 8 }}>
                <div className="referral-field-row">
                  <div>
                    <label style={fieldLabel} htmlFor="desk-parent-first">Parent first name</label>
                    <input id="desk-parent-first" value={parentFirst} onChange={(e) => setParentFirst(e.target.value)} style={fieldInput} />
                  </div>
                  <div>
                    <label style={fieldLabel} htmlFor="desk-parent-last">Parent last name</label>
                    <input id="desk-parent-last" value={parentLast} onChange={(e) => setParentLast(e.target.value)} style={fieldInput} />
                  </div>
                </div>
                <label style={fieldLabel} htmlFor="desk-booking">Booking link</label>
                <input id="desk-booking" value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} style={fieldInput} />
                <label style={fieldLabel} htmlFor="desk-phone">Clinic phone</label>
                <input id="desk-phone" value={clinicPhone} onChange={(e) => setClinicPhone(e.target.value)} style={fieldInput} />
                <label style={fieldLabel} htmlFor="desk-referrer">Referrer, office only</label>
                <input id="desk-referrer" value={referrerName} onChange={(e) => setReferrerName(e.target.value)} style={fieldInput} />
                <label style={fieldLabel} htmlFor="desk-notes">Internal notes</label>
                <textarea
                  id="desk-notes"
                  value={internalNotes}
                  rows={3}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  style={{ ...fieldInput, resize: "vertical", lineHeight: 1.4 }}
                />
                <button
                  type="button"
                  className="referral-text-btn"
                  style={{ color: "#f0b4b4", justifyContent: "flex-start" }}
                  onClick={clearForm}
                >
                  Start again
                </button>
              </div>
            ) : null}
          </div>
        ) : section === "assessment" ? (
          <div className="referral-sheet">
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em" }}>Assessment</h1>
            <p style={{ margin: "8px 0 22px", fontSize: 16, color: "#cad7e3" }}>
              Select the assessment pathway for this referral.
            </p>
            <div className="referral-assess" role="radiogroup" aria-label="Assessment">
              {(["ADHD", "ASD", "SLD"] as const).map((type) => {
                const selected = pathwaySet && assessmentType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setAssessmentType(type);
                      setPathwaySet(true);
                      setSendStatus(null);
                      setLetterFace("email");
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: selected ? "#edf3f8" : "#9eb2c6",
                      font: "inherit",
                      fontSize: 22,
                      fontWeight: selected ? 600 : 500,
                      padding: "8px 0",
                      cursor: "pointer",
                      borderBottom: selected ? "2px solid #a8cdc4" : "2px solid transparent",
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            <p style={hintStyle}>{missingMessage("pathway")}</p>
            <p style={{ margin: "36px auto 6px", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "#849aaf" }}>
              Assessment information
            </p>
            <p style={{ margin: "0 auto", maxWidth: 460, fontSize: 15, lineHeight: 1.5, color: "#cad7e3" }}>
              The selected assessment controls the parent communication template and additional fields.
            </p>
          </div>
        ) : (
          <div className="referral-sheet" style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 500, letterSpacing: "-0.03em" }}>Parent communication</h1>
            <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 16 }}>
              <button
                type="button"
                className="referral-nav-btn"
                aria-pressed={letterFace === "email"}
                style={{
                  color: letterFace === "email" ? "#edf3f8" : "#9eb2c6",
                  borderBottomColor: letterFace === "email" ? "#a8cdc4" : "transparent",
                  paddingTop: 0,
                }}
                onClick={() => setLetterFace("email")}
              >
                Email
              </button>
              <button
                type="button"
                className="referral-nav-btn"
                aria-pressed={letterFace === "text"}
                style={{
                  color: letterFace === "text" ? "#edf3f8" : "#9eb2c6",
                  borderBottomColor: letterFace === "text" ? "#a8cdc4" : "transparent",
                  paddingTop: 0,
                }}
                onClick={() => setLetterFace("text")}
              >
                Text
              </button>
            </div>
            <div className="referral-preview" aria-label="Message preview">
              <div style={{ padding: "10px 16px 0", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#849aaf" }}>
                Message preview
              </div>
              {letterFace === "text" ? (
                <pre className="referral-sms">{previewSms}</pre>
              ) : pathwaySet ? (
                <iframe title="Parent letter" srcDoc={previewEmailHtml} style={{ display: "block", width: "100%", height: 420, border: 0, background: "#f7fbfb" }} />
              ) : (
                <p style={{ margin: 0, padding: "28px 24px 36px", color: "#cad7e3", fontSize: 16 }}>
                  Choose ADHD, ASD, or SLD.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showSent ? null : (
        <div className="referral-footer">
          <button
            type="button"
            className="referral-text-btn"
            disabled={sectionIndex <= 0}
            onClick={() => {
              if (sectionIndex > 0) setSection(sections[sectionIndex - 1]);
            }}
          >
            ← Back
          </button>
          <div className="referral-footer-spacer" />
          <button type="button" className="referral-text-btn" onClick={() => {
            if (pasteOpen) {
              setPasteOpen(false);
              return;
            }
            setShowSent(false);
            setSection("upload");
          }}>
            Cancel
          </button>
          {section === "communication" ? (
            <button
              type="button"
              className="referral-text-btn"
              disabled={!readyToSend || sending}
              onClick={() => void sendToParent()}
              style={{
                color: readyToSend && !sending ? "#edf3f8" : "#5c7388",
                textDecoration: readyToSend && !sending ? "underline" : "none",
                textUnderlineOffset: 4,
              }}
            >
              {sendLabel} →
            </button>
          ) : (
            <button
              type="button"
              className="referral-text-btn"
              disabled={sectionIndex >= sections.length - 1}
              onClick={() => {
                if (sectionIndex < sections.length - 1) setSection(sections[sectionIndex + 1]);
              }}
              style={{ color: "#edf3f8" }}
            >
              Continue →
            </button>
          )}
          {section === "communication" && (sendStatus || needLine) ? (
            <span style={{ fontSize: 14, color: sendStatus?.type === "success" ? "#9bd6be" : "#f0b4b4" }}>
              {sendStatus?.message ?? needLine}
            </span>
          ) : null}
        </div>
      )}
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
  referrerName,
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
  referrerName?: string;
}) {
  const html = buildParentEmailHtml({
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
    referrerName,
  });

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid #B7E1DE",
        overflow: "hidden",
        background: "#F3F8F8",
      }}
    >
      <iframe
        title="Parent email preview"
        srcDoc={html}
        style={{
          width: "100%",
          minHeight: 380,
          border: "none",
          display: "block",
          background: "#F3F8F8",
        }}
      />
    </div>
  );
}
