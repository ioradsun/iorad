import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const maxCompanies = settings?.max_companies_per_run ?? 50;

    // Get companies to process (oldest processed first, or never processed)
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id, name")
      .order("last_processed_at", { ascending: true, nullsFirst: true })
      .limit(maxCompanies);

    if (compErr) throw compErr;
    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: "No companies to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create processing job
    const { data: job, error: jobErr } = await supabase
      .from("processing_jobs")
      .insert({
        trigger: "manual",
        status: "running",
        total_companies_targeted: companies.length,
        settings_snapshot: settings ?? {},
      })
      .select()
      .single();

    if (jobErr) throw jobErr;

    // Create job items
    const items = companies.map((c) => ({
      job_id: job.id,
      company_id: c.id,
      status: "pending",
    }));
    await supabase.from("processing_job_items").insert(items);

    // Process each company (placeholder – marks as succeeded with 0 signals)
    let succeeded = 0;
    let failed = 0;

    for (const company of companies) {
      try {
        // Update item to running
        await supabase
          .from("processing_job_items")
          .update({ status: "running", started_at: new Date().toISOString() })
          .eq("job_id", job.id)
          .eq("company_id", company.id);

        // TODO: actual signal search goes here

        // Mark item succeeded
        await supabase
          .from("processing_job_items")
          .update({
            status: "succeeded",
            finished_at: new Date().toISOString(),
            signals_found_count: 0,
            snapshot_status: "Low Signal",
          })
          .eq("job_id", job.id)
          .eq("company_id", company.id);

        // Update company
        await supabase
          .from("companies")
          .update({
            last_processed_at: new Date().toISOString(),
            snapshot_status: "Low Signal",
          })
          .eq("id", company.id);

        succeeded++;
      } catch (e) {
        failed++;
        await supabase
          .from("processing_job_items")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            error_message: e.message,
          })
          .eq("job_id", job.id)
          .eq("company_id", company.id);
      }
    }

    // Finalize job
    await supabase
      .from("processing_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        companies_processed: succeeded + failed,
        companies_succeeded: succeeded,
        companies_failed: failed,
      })
      .eq("id", job.id);

    return new Response(
      JSON.stringify({
        job_id: job.id,
        processed: succeeded + failed,
        succeeded,
        failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
