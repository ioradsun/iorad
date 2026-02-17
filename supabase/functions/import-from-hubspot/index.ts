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
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    // HubSpot webhook sends an array of events
    // Manual trigger can send { action: "sync" } to pull recent companies
    if (body.action === "sync") {
      return await syncRecentCompanies(supabase);
    }

    // Handle HubSpot webhook events (array of subscription events)
    const events: any[] = Array.isArray(body) ? body : [body];
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        // HubSpot webhook event structure
        const objectId = event.objectId;
        if (!objectId) {
          skipped++;
          continue;
        }

        // Fetch company details from HubSpot API
        const company = await fetchHubSpotCompany(objectId);
        if (!company) {
          skipped++;
          continue;
        }

        await upsertCompany(supabase, company);
        imported++;
      } catch (err: any) {
        errors.push(`Event ${event.objectId || "unknown"}: ${err.message}`);
        skipped++;
      }
    }

    console.log(`HubSpot webhook: ${imported} imported, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, imported, skipped, errors: errors.slice(0, 10) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("import-from-hubspot error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Fetch a single company from HubSpot by ID
async function fetchHubSpotCompany(objectId: string | number) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const properties = "name,domain,industry,country,numberofemployees,hubspot_owner_id";
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/companies/${objectId}?properties=${properties}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data;
}

// Pull recently created companies from HubSpot (manual sync)
async function syncRecentCompanies(supabase: any) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const properties = "name,domain,industry,country,numberofemployees";
  
  // Fetch companies created in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const searchBody = {
    filterGroups: [
      {
        filters: [
          {
            propertyName: "createdate",
            operator: "GTE",
            value: sevenDaysAgo,
          },
        ],
      },
    ],
    properties: properties.split(","),
    limit: 100,
    sorts: [{ propertyName: "createdate", direction: "DESCENDING" }],
  };

  const res = await fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(searchBody),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot search error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const results = data.results || [];

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const company of results) {
    try {
      await upsertCompany(supabase, company);
      imported++;
    } catch (err: any) {
      errors.push(`${company.properties?.name || company.id}: ${err.message}`);
      skipped++;
    }
  }

  console.log(`HubSpot sync: ${imported} imported, ${skipped} skipped out of ${results.length}`);

  return new Response(
    JSON.stringify({
      success: true,
      imported,
      skipped,
      total: results.length,
      errors: errors.slice(0, 10),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Upsert a HubSpot company into our companies table
async function upsertCompany(supabase: any, hubspotCompany: any) {
  const props = hubspotCompany.properties || {};
  const name = props.name || "";
  if (!name.trim()) throw new Error("No company name");

  const domain = props.domain
    ? props.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : null;

  const companyData: Record<string, any> = {
    name: name.trim(),
    domain,
    industry: props.industry || null,
    hq_country: props.country || null,
    headcount: props.numberofemployees ? parseInt(String(props.numberofemployees), 10) || null : null,
  };

  // Try to find existing by domain first
  if (domain) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      // Update existing
      await supabase.from("companies").update(companyData).eq("id", existing.id);
      return;
    }
  }

  // Insert new company
  await supabase.from("companies").insert(companyData);
}
