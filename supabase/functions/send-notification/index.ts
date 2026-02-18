import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { subject, results } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch all admin users
    const { data: { users }, error: usersErr } = await sb.auth.admin.listUsers();
    if (usersErr) throw usersErr;

    const { data: adminRoles } = await sb.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    const admins = (users || [])
      .filter((u: any) => adminIds.has(u.id) && u.email)
      .map((u: any) => ({ email: u.email as string, name: (u.user_metadata?.full_name || u.email) as string }));

    if (admins.length === 0) {
      console.log("No admin emails found, skipping notification");
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const done = (results || []).filter((r: any) => r.status === "done").length;
    const errored = (results || []).filter((r: any) => r.status === "error").length;

    const errorRows = (results || [])
      .filter((r: any) => r.status === "error")
      .map((r: any) => `
        <tr>
          <td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:13px">${r.name}</td>
          <td style="padding:6px 12px;border:1px solid #e2e8f0;font-size:13px;color:#dc2626">${r.message || "Unknown error"}</td>
        </tr>`)
      .join("");

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden">
    <div style="background:#0f172a;padding:20px 24px">
      <h1 style="margin:0;color:white;font-size:18px">iorad Intelligence</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">Bulk Story Generation Report</p>
    </div>
    <div style="padding:24px">
      <div style="display:flex;gap:16px;margin-bottom:24px">
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:#16a34a">${done}</div>
          <div style="font-size:12px;color:#15803d;margin-top:4px">Succeeded</div>
        </div>
        <div style="flex:1;background:${errored > 0 ? "#fef2f2" : "#f0fdf4"};border:1px solid ${errored > 0 ? "#fecaca" : "#bbf7d0"};border-radius:6px;padding:16px;text-align:center">
          <div style="font-size:28px;font-weight:700;color:${errored > 0 ? "#dc2626" : "#16a34a"}">${errored}</div>
          <div style="font-size:12px;color:${errored > 0 ? "#b91c1c" : "#15803d"};margin-top:4px">Failed</div>
        </div>
      </div>
      ${errorRows ? `
      <h3 style="margin:0 0 12px;font-size:14px;color:#dc2626">Failed Companies</h3>
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr style="background:#fef2f2">
            <th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#6b7280">Company</th>
            <th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;font-size:12px;color:#6b7280">Error</th>
          </tr>
        </thead>
        <tbody>${errorRows}</tbody>
      </table>
      ` : `<p style="color:#16a34a;font-size:14px;margin:0">🎉 All companies processed successfully!</p>`}
    </div>
    <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">Sent by iorad Intelligence · ${new Date().toUTCString()}</p>
    </div>
  </div>
</body>
</html>`;

    let sent = 0;
    const errors: string[] = [];

    for (const admin of admins) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "iorad Intelligence <notifications@iorad.com>",
            to: [admin.email],
            subject: subject || "Bulk Story Generation Complete",
            html: htmlBody,
          }),
        });

        if (res.ok) {
          sent++;
          console.log(`Notification sent to ${admin.email}`);
        } else {
          const errText = await res.text();
          console.warn(`Resend failed for ${admin.email} (${res.status}): ${errText}`);
          errors.push(`${admin.email}: ${errText.substring(0, 100)}`);
        }
      } catch (emailErr) {
        console.error(`Error sending to ${admin.email}:`, emailErr);
        errors.push(`${admin.email}: ${emailErr}`);
      }
    }

    console.log(`Notification complete: ${sent}/${admins.length} sent`);
    return new Response(JSON.stringify({ success: true, sent, total: admins.length, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-notification error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
