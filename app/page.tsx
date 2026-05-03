"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PIN = "azuremind";

const DEFAULT_BOOKING_LINK =
  "https://azurepsychology-cockburn.au1.cliniko.com/bookings";
const DEFAULT_CLINIC_PHONE = "0422 182 967";

type AssessmentType = "ADHD" | "ASD" | "SLD";

type SentChannel = "email+sms" | "email" | "sms";

type SentEntry = {
  id: string;
  at: string;
  childFirst: string;
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
  const [unlocked, setUnlocked] = useState(false);

  const [childFirst, setChildFirst] = useState("");
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

  const childFirstNameRef = useRef<HTMLInputElement>(null);

  function scrollToTopAndFocus() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => childFirstNameRef.current?.focus(), 250);
  }

  const handleUnlock = (e: FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().toLowerCase() === PIN.toLowerCase()) {
      setUnlocked(true);
      setPinError(null);
    } else {
      setPinError("Incorrect PIN.");
    }
  };

  const validateCoreFields = useCallback((): boolean => {
    if (
      !childFirst.trim() ||
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
    parentFirst,
    parentLast,
    parentMobile,
    bookingLink,
    clinicPhone,
  ]);

  useEffect(() => {
    const fields = {
      childFirst,
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
    parentFirst,
    parentLast,
    parentEmail,
    parentMobile,
    assessmentType,
    bookingLink,
    clinicPhone,
  ]);

  const pushSent = useCallback(
    (channel: SentChannel) => {
      const entry: SentEntry = {
        id: uid(),
        at: new Date().toISOString(),
        childFirst,
        parentFirst,
        parentLast,
        parentEmail,
        parentMobile,
        assessmentType,
        bookingLink,
        clinicPhone,
        internalNotes,
        referrerName,
        referrerType,
        referrerEmail,
        channel,
      };
      setSentRegister((prev) => [entry, ...prev]);
    },
    [
      childFirst,
      parentFirst,
      parentLast,
      parentEmail,
      parentMobile,
      assessmentType,
      bookingLink,
      clinicPhone,
      internalNotes,
      referrerName,
      referrerType,
      referrerEmail,
    ]
  );

  const sendEmailWithCurrentForm = useCallback(async (): Promise<boolean> => {
    const fields = {
      childFirst,
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
    parentFirst,
    parentLast,
    parentEmail,
    parentMobile,
    assessmentType,
    bookingLink,
    clinicPhone,
  ]);

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

  const copyRegister = () => copyText("Register", registerCsv);

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
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
              Azure Mind
            </h1>
            <p style={{ fontSize: 13, opacity: 0.92, marginTop: 6 }}>
              Referral Admin — sign in
            </p>
          </header>
          <form onSubmit={handleUnlock} style={{ ...card, marginBottom: 0 }}>
            <label style={labelFirst} htmlFor="pin">
              PIN
            </label>
            <input
              id="pin"
              type="password"
              autoComplete="current-password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              style={inputStyle}
            />
            {pinError ? (
              <p style={{ color: "#b91c1c", fontSize: 13, marginTop: 10 }}>
                {pinError}
              </p>
            ) : null}
            <button
              type="submit"
              style={{
                ...btnPrimary,
                width: "100%",
                marginTop: 16,
              }}
            >
              Unlock
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
        <header style={headerBar}>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Azure Mind
          </h1>
          <p style={{ fontSize: 14, opacity: 0.92, marginTop: 4 }}>
            Referral Admin Tool
          </p>
        </header>

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
                className={`send-status-banner send-status-banner--${sendStatus.type}`}
                role="status"
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
                      pushSent("email+sms");
                      setSendStatus({
                        type: "success",
                        message: "Email and SMS sent successfully.",
                      });
                    } else {
                      pushSent("email");
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
                      pushSent("email");
                      setSendStatus({
                        type: "success",
                        message: "Email sent successfully.",
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
                      pushSent("sms");
                      setSendStatus({
                        type: "success",
                        message: "SMS sent successfully.",
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
                gap: 10,
                marginBottom: 14,
              }}
            >
              <h2 style={{ ...sectionTitle, marginBottom: 0 }}>
                Sent register ({sentRegister.length})
              </h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="button"
                  style={{
                    ...btnSecondary,
                    opacity: sentRegister.length === 0 ? 0.45 : 1,
                  }}
                  onClick={copyRegister}
                  disabled={sentRegister.length === 0}
                >
                  Copy Register
                </button>
                <button
                  type="button"
                  style={{
                    ...btnSecondary,
                    opacity: sentRegister.length === 0 ? 0.45 : 1,
                  }}
                  onClick={downloadCsv}
                  disabled={sentRegister.length === 0}
                >
                  Download CSV
                </button>
              </div>
            </div>
            {sentRegister.length === 0 ? (
              <p style={{ fontSize: 13, color: "#64748b" }}>
                No entries yet. Use send placeholders or actions that record to the
                register.
              </p>
            ) : (
              <ul
                style={{
                  listStyle: "none",
                  maxHeight: 280,
                  overflow: "auto",
                  padding: 0,
                  margin: 0,
                }}
              >
                {sentRegister.map((r) => (
                  <li
                    key={r.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid #B7E1DE",
                      fontSize: 13,
                    }}
                  >
                    <strong>{r.childFirst || "(child)"}</strong> —{" "}
                    {r.parentFirst} {r.parentLast} · {r.assessmentType} ·{" "}
                    <span style={{ color: "#0E9F98" }}>{r.channel}</span>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      {new Date(r.at).toLocaleString()}
                    </div>
                  </li>
                ))}
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
  parentFirst,
  parentLast,
  parentEmail,
  parentMobile,
  assessmentType,
  bookingLink,
  clinicPhone,
}: {
  childFirst: string;
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
