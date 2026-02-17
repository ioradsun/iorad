import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clayApiKey = Deno.env.get("CLAY_API_KEY");
    const clayTableId = Deno.env.get("CLAY_TABLE_ID");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!clayApiKey || !clayTableId) {
      return new Response(
        JSON.stringify({ error: "Clay API key or Table ID not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { company_id } = await req.json();
    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch company
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .select("*")
      .eq("id", company_id)
      .single();

    if (companyErr || !company) {
      return new Response(
        JSON.stringify({ error: "Company not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get latest snapshot for executive framing
    const { data: snapshot } = await supabase
      .from("snapshots")
      .select("snapshot_json, score_total")
      .eq("company_id", company_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const snapshotJson = snapshot?.snapshot_json as Record<string, any> | null;
    const executiveFraming =
      snapshotJson?.outbound_positioning?.executive_framing ||
      snapshotJson?.executive_narrative ||
      "";

    // Push to Clay
    const clayPayload = {
      records: [{
        id: company.id,
        cells: {
          "Company Name": company.name,
          "Domain": company.domain || "",
          "Industry": company.industry || "",
          "Partner": company.partner || "",
          "Persona": company.persona || "",
          "Score": snapshot?.score_total || company.last_score_total || 0,
          "Snapshot Status": company.snapshot_status || "",
          "Executive Framing": executiveFraming,
          "Min Contacts": 5,
          "Job Title Keywords": "enablement, learning, change management, L&D, education, Customer Education, Partner enablement, readiness, sales enablement, revenue enablement",
        },
      }],
    };

    const clayResp = await fetch(`https://api.clay.com/v3/tables/${clayTableId}/records`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${clayApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clayPayload),
    });

    if (!clayResp.ok) {
      const errText = await clayResp.text();
      console.error(`Clay push failed for ${company.name}: ${clayResp.status} ${errText}`);
      return new Response(
        JSON.stringify({ error: `Clay API error: ${clayResp.status}`, detail: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update clay_pushed_at
    await supabase
      .from("companies")
      .update({ clay_pushed_at: new Date().toISOString() })
      .eq("id", company_id);

    console.log(`Manually pushed ${company.name} to Clay`);

    return new Response(
      JSON.stringify({ success: true, company: company.name }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("push-to-clay error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
