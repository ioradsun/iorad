import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, description, author_name } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const htmlBody = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden">
    <div style="background:#0f172a;padding:20px 24px">
      <h1 style="margin:0;color:white;font-size:18px">New Feedback Posted</h1>
      <p style="margin:4px 0 0;color:#94a3b8;font-size:13px">iorad Scout</p>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 8px;font-size:13px;color:#64748b">Posted by <strong>${author_name || "Unknown"}</strong></p>
      <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a">${title || "Untitled"}</h2>
      <p style="margin:0;font-size:14px;color:#334155;line-height:1.6">${description || ""}</p>
    </div>
    <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">Sent by iorad Scout · ${new Date().toUTCString()}</p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "iorad Scout <notifications@iorad.info>",
        to: ["spatel@iorad.com"],
        subject: `New Feedback: ${title || "Untitled"}`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Resend API failed [${res.status}]: ${errText}`);
    }

    const data = await res.json();
    console.log("Feedback notification sent to spatel@iorad.com");

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-feedback error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
