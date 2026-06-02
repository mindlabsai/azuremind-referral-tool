import { createClient } from "@supabase/supabase-js";
import { clinikoGetPatientAppointments } from "@/lib/cliniko";

type DueReferralRow = {
  id: string | number;
  created_at: string;
  follow_up_stage: number | null;
  next_follow_up_at: string | null;
  status: string | null;
  opted_out: boolean | null;
  cliniko_patient_id: string | null;
  parent_email: string | null;
  parent_mobile: string | null;
  child_first_name: string | null;
  assessment_type: string | null;
};

function internalApiOrigin(req: Request): string {
  if (process.env.TEXLEX_INTERNAL_BASE_URL) return process.env.TEXLEX_INTERNAL_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(req.url).origin;
}

function dueAtFromCreated(createdAtIso: string, days: number): string {
  const createdAtMs = new Date(createdAtIso).getTime();
  return new Date(createdAtMs + days * 24 * 60 * 60 * 1000).toISOString();
}

function stagePlan(
  stage: number,
  referral: DueReferralRow,
  unsubscribeLink: string
):
  | {
      channel: "email" | "sms";
      subject?: string;
      body: string;
      nextStage: number;
      nextFollowUpAt: string | null;
      nextStatus: "active" | "completed";
    }
  | null {
  const childName = (referral.child_first_name ?? "").trim() || "your child";
  const pathway = (referral.assessment_type ?? "assessment").trim();

  if (stage === 0) {
    return {
      channel: "email",
      subject: "Azure Mind follow-up (Day 2)",
      body: `<p>Hi, this is a quick follow-up about ${childName}'s ${pathway} enquiry.</p>
<p>Placeholder copy for Day 2 email.</p>
<p style="margin-top:18px;font-size:12px;color:#666">To stop follow-ups, <a href="${unsubscribeLink}">unsubscribe here</a>.</p>`,
      nextStage: 1,
      nextFollowUpAt: dueAtFromCreated(referral.created_at, 7),
      nextStatus: "active",
    };
  }

  if (stage === 1) {
    return {
      channel: "sms",
      body: `Azure Mind follow-up (Day 7): placeholder SMS for ${childName}'s ${pathway} enquiry.`,
      nextStage: 2,
      nextFollowUpAt: dueAtFromCreated(referral.created_at, 14),
      nextStatus: "active",
    };
  }

  if (stage === 2) {
    return {
      channel: "email",
      subject: "Azure Mind follow-up (Day 14)",
      body: `<p>Hi, this is your Day 14 follow-up for ${childName}'s ${pathway} enquiry.</p>
<p>Placeholder copy for Day 14 email.</p>
<p style="margin-top:18px;font-size:12px;color:#666">To stop follow-ups, <a href="${unsubscribeLink}">unsubscribe here</a>.</p>`,
      nextStage: 3,
      nextFollowUpAt: dueAtFromCreated(referral.created_at, 28),
      nextStatus: "active",
    };
  }

  if (stage === 3) {
    return {
      channel: "email",
      subject: "Azure Mind final follow-up (Day 28)",
      body: `<p>Final follow-up for ${childName}'s ${pathway} enquiry.</p>
<p>Placeholder final email copy.</p>
<p style="margin-top:18px;font-size:12px;color:#666">To stop follow-ups, <a href="${unsubscribeLink}">unsubscribe here</a>.</p>`,
      nextStage: 4,
      nextFollowUpAt: null,
      nextStatus: "completed",
    };
  }

  return null;
}

async function sendFollowUpEmail(origin: string, to: string, subject: string, html: string): Promise<boolean> {
  const response = await fetch(`${origin}/api/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, html }),
  });
  const json = (await response.json().catch(() => ({}))) as { success?: boolean };
  return response.ok && json.success === true;
}

async function sendFollowUpSms(origin: string, to: string, message: string): Promise<boolean> {
  const response = await fetch(`${origin}/api/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, message }),
  });
  const json = (await response.json().catch(() => ({}))) as { success?: boolean };
  return response.ok && json.success === true;
}

export async function GET(req: Request) {
  const expectedSecret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization") ?? "";

  if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { ok: false, error: "Supabase server credentials missing for cron route" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();
  const origin = internalApiOrigin(req);

  const summary = {
    scanned: 0,
    booked: 0,
    sent: 0,
    completed: 0,
    skipped: 0,
    errors: 0,
  };

  const { data, error } = await supabase
    .from("referrals")
    .select(
      "id, created_at, follow_up_stage, next_follow_up_at, status, opted_out, cliniko_patient_id, parent_email, parent_mobile, child_first_name, assessment_type"
    )
    .eq("status", "active")
    .eq("opted_out", false)
    .lte("next_follow_up_at", nowIso)
    .order("next_follow_up_at", { ascending: true })
    .limit(200);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as DueReferralRow[];
  summary.scanned = rows.length;

  for (const row of rows) {
    const stage = Number(row.follow_up_stage ?? 0);
    if (!Number.isFinite(stage) || stage < 0) {
      summary.skipped += 1;
      continue;
    }

    if (row.cliniko_patient_id) {
      try {
        const { hasUpcomingBooking } = await clinikoGetPatientAppointments(row.cliniko_patient_id);
        if (hasUpcomingBooking) {
          const { error: updateError } = await supabase
            .from("referrals")
            .update({
              status: "booked",
              next_follow_up_at: null,
            })
            .eq("id", row.id)
            .eq("status", "active")
            .eq("opted_out", false)
            .eq("follow_up_stage", stage);

          if (updateError) summary.errors += 1;
          else summary.booked += 1;
          continue;
        }
      } catch (appointmentError) {
        console.error(`[cron/follow-ups] appointment check failed for referral ${row.id}`, appointmentError);
        summary.errors += 1;
        continue;
      }
    }

    const unsubscribeLink = `${origin}/api/follow-ups/unsubscribe?id=${encodeURIComponent(String(row.id))}`;
    const plan = stagePlan(stage, row, unsubscribeLink);
    if (!plan) {
      summary.skipped += 1;
      continue;
    }

    let sendOk = false;
    try {
      if (plan.channel === "email") {
        if (!row.parent_email?.trim()) {
          summary.skipped += 1;
          continue;
        }
        sendOk = await sendFollowUpEmail(origin, row.parent_email.trim(), plan.subject ?? "Azure Mind follow-up", plan.body);
      } else {
        if (!row.parent_mobile?.trim()) {
          summary.skipped += 1;
          continue;
        }
        sendOk = await sendFollowUpSms(origin, row.parent_mobile.trim(), plan.body);
      }
    } catch (sendError) {
      console.error(`[cron/follow-ups] send failed for referral ${row.id}`, sendError);
      summary.errors += 1;
      continue;
    }

    if (!sendOk) {
      summary.errors += 1;
      continue;
    }

    const { error: advanceError } = await supabase
      .from("referrals")
      .update({
        follow_up_stage: plan.nextStage,
        next_follow_up_at: plan.nextFollowUpAt,
        status: plan.nextStatus,
      })
      .eq("id", row.id)
      .eq("status", "active")
      .eq("opted_out", false)
      .eq("follow_up_stage", stage);

    if (advanceError) {
      summary.errors += 1;
      continue;
    }

    summary.sent += 1;
    if (plan.nextStatus === "completed") summary.completed += 1;
  }

  return Response.json({ ok: true, summary });
}
