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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify Clay API key if provided in header (optional security)
    const authHeader = req.headers.get("x-clay-api-key");
    if (clayApiKey && authHeader && authHeader !== clayApiKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Support both single row and batch of rows
    const rows: Record<string, any>[] = Array.isArray(body) ? body : [body];

    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: "No rows provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        // Flexible field mapping — Clay columns can vary
        const name =
          row.company_name || row.name || row.Company || row["Company Name"] || row.company || "";
        if (!name.trim()) {
          skipped++;
          continue;
        }

        const domain =
          row.domain || row.Domain || row.website || row.Website || row["Company Domain"] || null;
        const cleanDomain = domain
          ? domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
          : null;

        const companyData: Record<string, any> = {
          name: name.trim(),
          domain: cleanDomain,
          industry: row.industry || row.Industry || null,
          partner: row.partner || row.Partner || null,
          hq_country: row.hq_country || row.country || row.Country || row["HQ Country"] || null,
          headcount: row.headcount || row.Headcount || row["Employee Count"]
            ? parseInt(String(row.headcount || row.Headcount || row["Employee Count"]), 10) || null
            : null,
          persona: row.persona || row.Persona || null,
          buyer_name: row.buyer_name || row["Buyer Name"] || row["Contact Name"] || null,
          buyer_title: row.buyer_title || row["Buyer Title"] || row["Contact Title"] || null,
          buyer_email: row.buyer_email || row["Buyer Email"] || row["Contact Email"] || row.email || null,
          buyer_linkedin:
            row.buyer_linkedin || row["Buyer LinkedIn"] || row["LinkedIn URL"] || row.linkedin || null,
          partner_rep_name: row.partner_rep_name || row["Partner Rep Name"] || null,
          partner_rep_email: row.partner_rep_email || row["Partner Rep Email"] || null,
        };

        // Remove null values to avoid overwriting existing data
        const cleanData: Record<string, any> = { name: companyData.name };
        for (const [k, v] of Object.entries(companyData)) {
          if (v !== null && v !== undefined && v !== "") cleanData[k] = v;
        }

        // Upsert by domain if available, otherwise insert
        if (cleanDomain) {
          const { data: existing } = await supabase
            .from("companies")
            .select("id")
            .eq("domain", cleanDomain)
            .maybeSingle();

          if (existing) {
            await supabase
              .from("companies")
              .update(cleanData)
              .eq("id", existing.id);
          } else {
            await supabase.from("companies").insert(cleanData);
          }
        } else {
          await supabase.from("companies").insert(cleanData);
        }

        imported++;
      } catch (err: any) {
        errors.push(`Row "${row.name || row.company_name || "unknown"}": ${err.message}`);
        skipped++;
      }
    }

    console.log(`Clay import: ${imported} imported, ${skipped} skipped, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        skipped,
        total: rows.length,
        errors: errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("import-from-clay error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
