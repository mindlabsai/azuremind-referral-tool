"use client";

import { computeChronologicalAge, placeholderForKind } from "@/app/asd-engine/report/pdf/utils";

export type SldDemographics = {
  pronouns: string;
  yearLevel: string;
  school: string;
  reportDate: string;
  assessmentDate: string;
  parent1: string;
  parent1Email: string;
  parent1Relationship: string;
  parent2: string;
  parent2Email: string;
  parent2Relationship: string;
  referringPractitioner: string;
  referringPractitionerType: string;
  referringPractitionerEmail: string;
  phone: string;
  address: string;
  assessor: string;
};

export function emptySldDemographics(): SldDemographics {
  return {
    pronouns: "",
    yearLevel: "",
    school: "",
    reportDate: "",
    assessmentDate: "",
    parent1: "",
    parent1Email: "",
    parent1Relationship: "",
    parent2: "",
    parent2Email: "",
    parent2Relationship: "",
    referringPractitioner: "",
    referringPractitionerType: "",
    referringPractitionerEmail: "",
    phone: "",
    address: "",
    assessor: "",
  };
}

const RELATIONSHIPS = ["mother", "father", "carer", "guardian", "other"] as const;

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="report-client">
      {label}
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Relationship({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="report-client report-sub">
      Relationship
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Optional</option>
        {RELATIONSHIPS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SldDemographicsFields({
  clientName,
  dob,
  details,
  onClientName,
  onDob,
  onChange,
}: {
  clientName: string;
  dob: string;
  details: SldDemographics;
  onClientName: (value: string) => void;
  onDob: (value: string) => void;
  onChange: (patch: Partial<SldDemographics>) => void;
}) {
  const age = dob.trim() ? computeChronologicalAge(dob) : "";
  const ageText = age && age !== placeholderForKind("notProvided") ? age : "";

  return (
    <div className="report-details-wrap">
      <table className="report-details">
        <tbody>
          <tr>
            <td>
              <Field label="Client name" value={clientName} onChange={onClientName} />
            </td>
            <td>
              <Field label="Parent/Carer 1" value={details.parent1} onChange={(parent1) => onChange({ parent1 })} />
              <Field
                label="Parent/Carer 1 email"
                type="email"
                value={details.parent1Email}
                placeholder="parent@email.com"
                onChange={(parent1Email) => onChange({ parent1Email })}
              />
              <Relationship
                value={details.parent1Relationship}
                onChange={(parent1Relationship) => onChange({ parent1Relationship })}
              />
            </td>
          </tr>
          <tr>
            <td />
            <td>
              <Field
                label="Parent/Carer 2"
                value={details.parent2}
                placeholder="Optional"
                onChange={(parent2) => onChange({ parent2 })}
              />
              <Field
                label="Parent/Carer 2 email"
                type="email"
                value={details.parent2Email}
                placeholder="optional"
                onChange={(parent2Email) => onChange({ parent2Email })}
              />
              <Relationship
                value={details.parent2Relationship}
                onChange={(parent2Relationship) => onChange({ parent2Relationship })}
              />
            </td>
          </tr>
          <tr>
            <td>
              <Field label="Date of birth" type="date" value={dob} onChange={onDob} />
              <label className="report-client report-sub">
                Chronological age
                <input readOnly tabIndex={-1} value={ageText} placeholder="From the date of birth" />
              </label>
            </td>
            <td>
              <Field
                label="Referring practitioner"
                value={details.referringPractitioner}
                onChange={(referringPractitioner) => onChange({ referringPractitioner })}
              />
              <Field
                label="Referrer type"
                value={details.referringPractitionerType}
                placeholder="Optional"
                onChange={(referringPractitionerType) => onChange({ referringPractitionerType })}
              />
              <Field
                label="Referrer email"
                type="email"
                value={details.referringPractitionerEmail}
                placeholder="referrer@clinic.com.au"
                onChange={(referringPractitionerEmail) => onChange({ referringPractitionerEmail })}
              />
            </td>
          </tr>
          <tr>
            <td>
              <Field
                label="Date of assessment"
                type="date"
                value={details.assessmentDate}
                onChange={(assessmentDate) => onChange({ assessmentDate })}
              />
            </td>
            <td>
              <Field
                label="Date of report"
                type="date"
                value={details.reportDate}
                onChange={(reportDate) => onChange({ reportDate })}
              />
            </td>
          </tr>
          <tr>
            <td>
              <Field label="School" value={details.school} onChange={(school) => onChange({ school })} />
            </td>
            <td>
              <Field
                label="Year level"
                value={details.yearLevel}
                placeholder="e.g. Year 4"
                onChange={(yearLevel) => onChange({ yearLevel })}
              />
            </td>
          </tr>
          <tr>
            <td>
              <Field label="Phone" value={details.phone} onChange={(phone) => onChange({ phone })} />
            </td>
            <td>
              <Field label="Address" value={details.address} onChange={(address) => onChange({ address })} />
            </td>
          </tr>
          <tr>
            <td>
              <Field label="Assessor" value={details.assessor} onChange={(assessor) => onChange({ assessor })} />
            </td>
            <td>
              <Field label="Pronouns" value={details.pronouns} onChange={(pronouns) => onChange({ pronouns })} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
