import { defaultClinicSlug } from "./config";
import { referralIntakeSupabase } from "./supabase-admin";
import type { ReferralDashboardStatus, ReferralInboxRow } from "./types";

const DASHBOARD_STATUSES: ReferralDashboardStatus[] = [
  "new",
  "awaiting_review",
  "ready_for_contact",
  "contacted",
  "booked",
  "closed",
  "processing_error",
];

export type InboxSourceFilter = "intake" | "legacy" | "all";

export function allDashboardStatuses(): ReferralDashboardStatus[] {
  return [...DASHBOARD_STATUSES];
}

export async function listInboxReferrals(args?: {
  clinicSlug?: string;
  status?: string;
  /** Default intake = rows with intake_event_id (genuine Gmail/inbound). */
  source?: InboxSourceFilter;
  limit?: number;
}): Promise<{
  rows: ReferralInboxRow[];
  counts: Record<string, number>;
  clinicSlug: string;
  source: InboxSourceFilter;
  legacyCount: number;
}> {
  const clinicSlug = (args?.clinicSlug || defaultClinicSlug()).trim().toLowerCase();
  const source: InboxSourceFilter = args?.source || "intake";
  const supabase = referralIntakeSupabase();

  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, slug, display_name")
    .eq("slug", clinicSlug)
    .maybeSingle();

  const baseCols = [
    "id",
    "clinic_id",
    "intake_event_id",
    "child_first_name",
    "child_last_name",
    "child_dob",
    "parent_first_name",
    "parent_last_name",
    "parent_email",
    "parent_mobile",
    "assessment_type",
    "referring_practitioner",
    "referring_practitioner_type",
    "referring_practitioner_email",
    "referral_source",
    "received_at",
    "first_contact_at",
    "created_at",
    "extraction_status",
    "extraction_confidence",
    "extraction_warnings",
    "contact_status",
    "booking_status",
    "dashboard_status",
    "needs_human_review",
    "patient_identity_conflict",
    "status",
    "notes",
    "original_document_id",
  ];
  const selectWithQa = [...baseCols, "auto_ready_at", "auto_ready_qa_status"].join(", ");
  const selectWithoutQa = baseCols.join(", ");

  async function runSelect(selectCols: string) {
    let q = supabase
      .from("referrals")
      .select(selectCols)
      .order("received_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(args?.limit ?? 200);
    if (clinic?.id) q = q.eq("clinic_id", clinic.id);
    if (source === "intake") q = q.not("intake_event_id", "is", null);
    else if (source === "legacy") q = q.is("intake_event_id", null);
    if (args?.status && args.status !== "all") q = q.eq("dashboard_status", args.status);
    return q;
  }

  let { data, error } = await runSelect(selectWithQa);
  if (error && /auto_ready_/i.test(error.message)) {
    ({ data, error } = await runSelect(selectWithoutQa));
  }
  if (error) {
    // patient_identity_conflict may be missing before phase3 SQL
    if (/patient_identity_conflict/i.test(error.message)) {
      return listInboxReferralsWithoutPhase3Columns(args);
    }
    throw new Error(error.message);
  }

  const referralIds = ((data ?? []) as unknown as Array<{ id: string }>).map((row) => row.id);
  const docsByReferral = await loadDocumentsByReferral(supabase, referralIds);
  const filenameById = new Map<string, string>();
  for (const list of docsByReferral.values()) {
    for (const doc of list) filenameById.set(doc.id, doc.filename);
  }

  const rows = ((data ?? []) as unknown as ReferralInboxRow[]).map((row) => ({
    ...row,
    clinic_slug: clinic?.slug ?? clinicSlug,
    clinic_name: clinic?.display_name ?? null,
    original_document_filename: row.original_document_id
      ? filenameById.get(row.original_document_id) ?? null
      : null,
    documents: docsByReferral.get(row.id) ?? [],
  }));

  const counts: Record<string, number> = Object.fromEntries(
    DASHBOARD_STATUSES.map((s) => [s, 0])
  );

  // Counts always reflect the selected source scope for the clinic
  if (clinic?.id) {
    let countQuery = supabase
      .from("referrals")
      .select("dashboard_status, intake_event_id")
      .eq("clinic_id", clinic.id)
      .limit(2000);
    if (source === "intake") countQuery = countQuery.not("intake_event_id", "is", null);
    if (source === "legacy") countQuery = countQuery.is("intake_event_id", null);
    const { data: allRows } = await countQuery;
    for (const row of allRows ?? []) {
      const key = String((row as { dashboard_status?: string }).dashboard_status || "new");
      counts[key] = (counts[key] ?? 0) + 1;
    }
  } else {
    for (const row of rows) {
      const key = row.dashboard_status || "new";
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }

  let legacyCount = 0;
  if (clinic?.id) {
    const { count } = await supabase
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic.id)
      .is("intake_event_id", null);
    legacyCount = count ?? 0;
  }

  return { rows, counts, clinicSlug, source, legacyCount };
}

async function loadDocumentsByReferral(
  supabase: ReturnType<typeof referralIntakeSupabase>,
  referralIds: string[]
): Promise<Map<string, NonNullable<ReferralInboxRow["documents"]>>> {
  const docsByReferral = new Map<string, NonNullable<ReferralInboxRow["documents"]>>();
  if (!referralIds.length) return docsByReferral;

  type DocRow = {
    id: string;
    referral_id?: string | null;
    filename?: string | null;
    content_type?: string | null;
    contains_referral_info?: boolean | null;
    extraction_role?: string | null;
    identity_conflict?: boolean | null;
    conflict_resolution?: string | null;
    extracted_child_first?: string | null;
    extracted_child_last?: string | null;
    extracted_child_dob?: string | null;
  };

  const labelled = await supabase
    .from("referral_documents")
    .select(
      "id, referral_id, filename, content_type, contains_referral_info, extraction_role, identity_conflict, conflict_resolution, extracted_child_first, extracted_child_last, extracted_child_dob"
    )
    .in("referral_id", referralIds)
    .order("created_at", { ascending: true });

  let docs: DocRow[] = [];
  if (!labelled.error) {
    docs = (labelled.data ?? []) as DocRow[];
  } else if (/identity_conflict|conflict_resolution|extracted_child/i.test(labelled.error.message)) {
    const basic = await supabase
      .from("referral_documents")
      .select("id, referral_id, filename, content_type, contains_referral_info, extraction_role")
      .in("referral_id", referralIds)
      .order("created_at", { ascending: true });
    docs = (basic.data ?? []) as DocRow[];
  } else if (/contains_referral_info|extraction_role/i.test(labelled.error.message)) {
    const basic = await supabase
      .from("referral_documents")
      .select("id, referral_id, filename, content_type")
      .in("referral_id", referralIds)
      .order("created_at", { ascending: true });
    docs = (basic.data ?? []) as DocRow[];
  } else {
    throw new Error(labelled.error.message);
  }

  for (const doc of docs) {
    const referralId = String(doc.referral_id ?? "");
    if (!referralId) continue;
    const list = docsByReferral.get(referralId) ?? [];
    list.push({
      id: String(doc.id),
      filename: String(doc.filename ?? "referral.bin"),
      content_type: doc.content_type ?? null,
      contains_referral_info:
        typeof doc.contains_referral_info === "boolean" ? doc.contains_referral_info : null,
      extraction_role: doc.extraction_role ?? null,
      identity_conflict: typeof doc.identity_conflict === "boolean" ? doc.identity_conflict : null,
      conflict_resolution: doc.conflict_resolution ?? null,
      extracted_child_first: doc.extracted_child_first ?? null,
      extracted_child_last: doc.extracted_child_last ?? null,
      extracted_child_dob: doc.extracted_child_dob ?? null,
    });
    docsByReferral.set(referralId, list);
  }
  return docsByReferral;
}

async function listInboxReferralsWithoutPhase3Columns(args?: {
  clinicSlug?: string;
  status?: string;
  source?: InboxSourceFilter;
  limit?: number;
}) {
  const clinicSlug = (args?.clinicSlug || defaultClinicSlug()).trim().toLowerCase();
  const source: InboxSourceFilter = args?.source || "intake";
  const supabase = referralIntakeSupabase();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, slug, display_name")
    .eq("slug", clinicSlug)
    .maybeSingle();

  let query = supabase
    .from("referrals")
    .select(
      [
        "id",
        "clinic_id",
        "intake_event_id",
        "child_first_name",
        "child_last_name",
        "child_dob",
        "parent_first_name",
        "parent_last_name",
        "parent_email",
        "parent_mobile",
        "assessment_type",
        "referring_practitioner",
        "referral_source",
        "received_at",
        "first_contact_at",
        "created_at",
        "extraction_status",
        "extraction_confidence",
        "extraction_warnings",
        "contact_status",
        "booking_status",
        "dashboard_status",
        "needs_human_review",
        "status",
        "notes",
        "original_document_id",
      ].join(", ")
    )
    .order("created_at", { ascending: false })
    .limit(args?.limit ?? 200);

  if (clinic?.id) query = query.eq("clinic_id", clinic.id);
  if (source === "intake") query = query.not("intake_event_id", "is", null);
  if (source === "legacy") query = query.is("intake_event_id", null);
  if (args?.status && args.status !== "all") query = query.eq("dashboard_status", args.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const referralIds = ((data ?? []) as unknown as Array<{ id: string }>).map((r) => r.id);
  const docsByReferral = await loadDocumentsByReferral(supabase, referralIds);

  const rows = ((data ?? []) as unknown as ReferralInboxRow[]).map((row) => ({
    ...row,
    clinic_slug: clinic?.slug ?? clinicSlug,
    clinic_name: clinic?.display_name ?? null,
    patient_identity_conflict: null,
    documents: docsByReferral.get(row.id) ?? [],
  }));

  const counts: Record<string, number> = Object.fromEntries(
    DASHBOARD_STATUSES.map((s) => [s, 0])
  );
  for (const row of rows) {
    const key = row.dashboard_status || "new";
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return { rows, counts, clinicSlug, source, legacyCount: 0 };
}
