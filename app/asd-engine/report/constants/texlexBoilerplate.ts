export const TEXLEX_HEADER = {
  confidential: "CONFIDENTIAL",
  reportType: "CONSENSUS-BASED NEURODEVELOPMENTAL ASSESSMENT REPORT",
  pathway: "Autism Spectrum Disorder Assessment Pathway",
};

export const TEXLEX_ASSESSMENT_CONTEXT = `This assessment was conducted as part of a consensus-based neurodevelopmental assessment pathway to explore the presence of Autism Spectrum Disorder (ASD) and associated developmental, behavioural, social-communication, sensory, and/or functional concerns.

The assessment process included clinical interview, behavioural observations obtained during assessment, developmental history review, and consideration of available collateral information and supporting documentation where applicable.

Assessment findings are intended to contribute to broader clinical understanding regarding the client's current presentation, functional profile, and support needs across relevant settings. The findings may assist in informing ongoing clinical, educational, behavioural, and/or supportive care planning where appropriate.`;

export const TEXLEX_CONSENT = `Informed consent for assessment, collateral information review, and report preparation was obtained prior to commencement of the assessment process.

This report reflects clinical observations, developmental history, behavioural presentation, collateral information, and assessment findings available at the time of assessment and should be interpreted within the broader developmental and clinical context of the client.

This report has been prepared for clinical, educational, and supportive care planning purposes only and is not intended to function as a standalone medico-legal or forensic opinion.

The information contained within this report is confidential and should only be distributed to individuals directly involved in the client's care, educational planning, or support pathway unless otherwise authorised or required by law.`;

export const TEXLEX_DSM_INTRO = `The following section considers the client's presentation in relation to DSM-5-TR diagnostic criteria for Autism Spectrum Disorder (ASD). Clinical interpretation was informed by developmental history, behavioural observations obtained during assessment, collateral information, and available supporting documentation.

Each criterion area was considered according to the degree to which available evidence supported the presence of clinically significant neurodevelopmental differences associated with Autism Spectrum Disorder.`;

export const TEXLEX_RATING_GUIDE = [
  { value: 0, label: "Not Supported" },
  { value: 1, label: "Partially Supported / Emerging Features" },
  { value: 2, label: "Supported" },
  { value: 3, label: "Strongly Supported" },
] as const;

export const TEXLEX_CRITERION_A_HEADER = {
  title: "A. Social Communication and Social Interaction",
  description:
    "Persistent differences in social communication and social interaction across multiple contexts, currently and/or by developmental history, as reflected in the following areas:",
};

export const TEXLEX_CRITERION_B_HEADER = {
  title: "B. Restricted and Repetitive Behaviour, Interests and Sensory Regulation",
  description:
    "Restricted and repetitive patterns of behaviour, interests and sensory regulation, currently and/or by developmental history, as reflected in the following areas:",
};

export const TEXLEX_CRITERIA = {
  A1: {
    title: "A1. Social-Emotional Reciprocity",
    description:
      "This criterion considers differences relating to reciprocal social interaction, conversational reciprocity, shared emotional engagement, initiation and response within social interaction, and the capacity to sustain socially reciprocal communication across settings.",
  },
  A2: {
    title: "A2. Non-Verbal Communicative Behaviours Used for Social Interaction",
    description:
      "This criterion considers differences relating to non-verbal communication, including eye contact, facial expression, gesture use, body language, and integration of verbal and non-verbal communication during social interaction.",
  },
  A3: {
    title: "A3. Developing, Maintaining and Understanding Relationships",
    description:
      "This criterion considers differences relating to peer relationships, social understanding, imaginative interaction, adjustment of behaviour across social contexts, and the capacity to develop and maintain age-appropriate social relationships.",
  },
  B1: {
    title: "B1. Repetitive Motor Movements, Use of Objects or Speech",
    description:
      "This criterion considers repetitive or stereotyped motor movements, repetitive speech patterns, repetitive play behaviours, echolalia, unusual phrasing, repetitive use of objects, and other repetitive behavioural patterns.",
  },
  B2: {
    title: "B2. Behavioural Rigidity, Sameness and Inflexibility",
    description:
      "This criterion considers distress associated with change, behavioural rigidity, transition difficulties, inflexible thinking patterns, ritualised behaviours, and a preference for predictability or sameness across routines and activities.",
  },
  B3: {
    title: "B3. Restricted or Highly Focused Interests",
    description:
      "This criterion considers highly focused, intense, repetitive, or unusually restricted interests that may differ in intensity, focus, flexibility, or developmental appropriateness relative to peers.",
  },
  B4: {
    title: "B4. Sensory Differences and Sensory Regulation",
    description:
      "This criterion considers sensory sensitivities, sensory avoidance, sensory-seeking behaviours, unusual sensory interests, altered sensory responses, and differences in sensory processing or sensory regulation across environments.",
  },
  C: {
    title: "C. Onset in Early Developmental Period",
    description:
      "Symptoms must be present in the early developmental period (but may not become fully manifest until social demands exceed limited capacities, or may be masked by learned strategies in later life).",
  },
  D: {
    title: "D. Clinically Significant Impairment",
    description:
      "Symptoms cause clinically significant impairment in social, occupational, or other important areas of current functioning.",
  },
  E: {
    title: "E. Not Better Explained by Intellectual Disability or Global Developmental Delay",
    description:
      "These disturbances are not better explained by intellectual disability (intellectual developmental disorder) or global developmental delay.",
  },
} as const;

export const TEXLEX_LIMITATIONS = `This report reflects the information available at the time of assessment and should be interpreted within the broader developmental and clinical context of the client.

Developmental presentations may evolve over time, and behavioural, emotional, social, adaptive, and functional profiles may vary across settings and developmental stages.

Assessment findings are based on clinical interview, behavioural observations obtained during assessment, available collateral information, and supporting documentation provided at the time of assessment.

This report should not be interpreted as a standalone predictor of future functioning, long-term outcomes, or eligibility for external services, supports, funding pathways, or educational provisions.

Where clinically indicated, ongoing review, multidisciplinary input, educational monitoring, medical review, and/or reassessment may remain appropriate.`;

export const TEXLEX_SIGNATURE = {
  closing: "Kind Regards,",
  signaturePlaceholder: "[Digital Signature]",
  name: "Vishal Maharaj",
  title: "Registered Psychologist",
  registration: "PSY0001579010",
  practice: "Azure Mind",
};

// Section model identifiers for the UI labels (small, subtle text under each section)
export const TEXLEX_SECTION_MODELS = {
  presentingConcerns: "Claude Opus 4.7",
  pregnancyBirth: "Claude Opus 4.7",
  earlyDevelopment: "Claude Opus 4.7",
  educationalHistory: "Claude Opus 4.7",
  emotionalBehaviouralSensory: "Claude Opus 4.7",
  collateralSummary: "Claude Sonnet 4.6",
  functionalImpactSummary: { generation: "Claude Sonnet 4.6", refinement: "Claude Opus 4.7" },
  clinicalFormulation: { generation: "Claude Sonnet 4.6", refinement: "Claude Opus 4.7" },
  recommendations: { generation: "Claude Sonnet 4.6", refinement: "Claude Opus 4.7" },
  dsmCriterion: { generation: "Claude Sonnet 4.6", refinement: "Claude Opus 4.7" },
} as const;
