/** Shared user-prompt guardrails for sections that must read as current clinical status, not history. */

export const CLINICAL_RECENCY_GATE_FORMULATION = `CRITICAL: The Clinical Formulation must reference only CURRENT clinical evidence — present-day clinical observation during this assessment, current parent report, and feedback from the client's CURRENT educational placement only.

Do NOT reference historical educational placements (previous schools, previous daycare), early developmental milestones, or historical clinician observations as live diagnostic evidence. These belong in the Background section.

For school-age clients, only reference the CURRENT school's educator feedback. For early childhood clients, only reference the CURRENT daycare or pre-primary placement.

Historical context may be acknowledged briefly only to establish developmental continuity (e.g. "longstanding pattern from early childhood"), but specific historical institutional names or specific historical feedback events must not appear in the Formulation.`;

export const CLINICAL_RECENCY_GATE_FUNCTIONAL_IMPACT = `CRITICAL: The Functional Impact Summary must describe only CURRENT functional impact — present-day home, the client's CURRENT educational or early-childcare placement, and current community participation.

Do NOT treat historical placements (previous schools, previous daycare), past milestones, or dated clinician or educator feedback as present-day functional evidence. Historical context belongs in Background; here it may appear only if clearly tied to enduring impact on current functioning (without naming past institutions or past specific events).`;

export const CLINICAL_RECENCY_GATE_RECOMMENDATIONS = `CRITICAL: Recommendations must address the CURRENT support pathway and CURRENT stakeholders (present school/centre, current treating team, family as now constituted).

Do NOT frame historical educational placements or past daycare/schools as current stakeholders or sites for intervention unless the client is still enrolled or actively linked there.`;

export const REFERRER_TYPE_HONESTY = `When referencing the referring practitioner, use the Referrer Type field from patient details to determine the correct professional title. The Referrer Type field values include:
- GP / General Practitioner
- Paediatrician / Developmental Paediatrician
- Psychiatrist / Child and Adolescent Psychiatrist
- Psychologist
- NDIS Provider
- School Psychologist
- Other

NEVER assume the referrer is a paediatrician. NEVER write "Developmental Paediatrician" unless the Referrer Type field explicitly says so.

If Referrer Type is "GP" or "General Practitioner", write: "referring GP [Name]" or "her general practitioner, Dr [Name]".

If Referrer Type is not specified, write: "referring practitioner Dr [Name]" without inferring a specialty.`;
