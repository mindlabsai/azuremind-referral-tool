import { createClient } from "@supabase/supabase-js";

function htmlMessage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${title}</title></head>
  <body style="font-family: Arial, sans-serif; background:#f6f8f9; margin:0; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
      <h1 style="margin:0 0 12px; font-size:22px; color:#0f172a;">${title}</h1>
      <p style="margin:0; font-size:15px; color:#334155; line-height:1.6;">${body}</p>
    </div>
  </body>
</html>`;
}

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      htmlMessage("Unable to process request", "Server configuration is incomplete. Please contact Azure Mind."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();

  if (!id) {
    return new Response(
      htmlMessage("Invalid unsubscribe link", "This unsubscribe link is missing a referral identifier."),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase
    .from("referrals")
    .update({
      opted_out: true,
      status: "opted_out",
      next_follow_up_at: null,
    })
    .eq("id", id);

  if (error) {
    return new Response(
      htmlMessage("Unable to unsubscribe", "We could not process your request right now. Please contact Azure Mind."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new Response(
    htmlMessage("You are unsubscribed", "You will no longer receive automated follow-up messages from Azure Mind."),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
