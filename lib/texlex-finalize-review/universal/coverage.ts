import type { ReviewSectionInput } from "../types";

export type SourceCoverage = {
  text: string;
  unavailable: string[];
};

/** What this Review pass was actually given. Unreadable files are named, not treated as empty evidence. */
export function describeSourceCoverage(args: {
  sections: ReviewSectionInput[];
  sourceNotes?: string;
}): SourceCoverage {
  const unavailable = [
    "Attached files that were not extracted into the draft text were not read.",
    "Appointment and practice-system records were not queried for this pass.",
    "Records for any other person were not opened.",
  ];
  const notes = args.sourceNotes?.trim() ?? "";
  const sectionCount = args.sections.filter((section) => section.text.trim()).length;
  const notesLine = notes
    ? "Raw notes supplied with this pass were included."
    : "Raw notes were not included in this pass.";
  if (!notes) unavailable.unshift("Raw notes were not supplied, so they could not be checked.");
  return {
    unavailable,
    text: `${notesLine} ${sectionCount} draft section${sectionCount === 1 ? "" : "s"} with text ${sectionCount === 1 ? "was" : "were"} included. ${unavailable[0]}`,
  };
}
