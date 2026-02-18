import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Verify HubSpot webhook signature (v1: HMAC-SHA256 of clientSecret + rawBody)
async function verifyHubSpotSignature(req: Request, rawBody: string): Promise<boolean> {
  const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
  if (!clientSecret) {
    console.warn("HUBSPOT_CLIENT_SECRET not set — skipping signature validation");
    return true; // Gracefully allow if secret not configured
  }

  const signature = req.headers.get("X-HubSpot-Signature") || req.headers.get("x-hubspot-signature");
  if (!signature) {
    console.warn("No HubSpot signature header found");
    return false;
  }

  // HubSpot v1: HMAC-SHA256(clientSecret + requestBody)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(clientSecret + rawBody));
  const expectedSig = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSig === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Manual sync trigger — skip signature check
    if (body.action === "sync") {
      return await syncRecentCompanies(supabase);
    }

    // Validate HubSpot webhook signature for all real webhook events
    const isValid = await verifyHubSpotSignature(req, rawBody);
    if (!isValid) {
      console.error("HubSpot signature validation failed — rejecting request");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle HubSpot webhook events (array of subscription events)
    const events: any[] = Array.isArray(body) ? body : [body];
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const objectId = event.objectId;
        if (!objectId) { skipped++; continue; }

        const company = await fetchHubSpotCompany(objectId);
        if (!company) { skipped++; continue; }

        const companyId = await upsertCompany(supabase, company);
        await importContactsForCompany(supabase, objectId, companyId);
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

// Fetch a single company from HubSpot by ID — pull ALL properties
async function fetchHubSpotCompany(objectId: string | number) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  // First get all available company properties to request them all
  const allProps = await getAllCompanyPropertyNames(apiKey);
  const propsParam = allProps.length > 0 ? allProps.join(",") : "name,domain,industry,country,numberofemployees,hubspot_owner_id";

  const res = await fetch(
    `https://api.hubapi.com/crm/v3/objects/companies/${objectId}?properties=${encodeURIComponent(propsParam)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot API error [${res.status}]: ${text}`);
  }

  const data = await res.json();
  return data;
}

// Cache for property names (per invocation)
let _companyPropNamesCache: string[] | null = null;
let _contactPropNamesCache: string[] | null = null;

async function getAllCompanyPropertyNames(apiKey: string): Promise<string[]> {
  if (_companyPropNamesCache) return _companyPropNamesCache;
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/companies", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    _companyPropNamesCache = (data.results || []).map((p: any) => p.name);
    return _companyPropNamesCache!;
  } catch { return []; }
}

async function getAllContactPropertyNames(apiKey: string): Promise<string[]> {
  if (_contactPropNamesCache) return _contactPropNamesCache;
  try {
    const res = await fetch("https://api.hubapi.com/crm/v3/properties/contacts", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    _contactPropNamesCache = (data.results || []).map((p: any) => p.name);
    return _contactPropNamesCache!;
  } catch { return []; }
}

// Pull recently created companies from HubSpot (manual sync)
async function syncRecentCompanies(supabase: any) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) throw new Error("HUBSPOT_API_KEY not configured");

  const allProps = await getAllCompanyPropertyNames(apiKey);
  const properties = allProps.length > 0 ? allProps.join(",") : "name,domain,industry,country,numberofemployees";
  
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
      const companyId = await upsertCompany(supabase, company);
      // Fetch and save associated contacts
      await importContactsForCompany(supabase, company.id, companyId);
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

// Upsert a HubSpot company into our companies table, returns the company ID
async function upsertCompany(supabase: any, hubspotCompany: any): Promise<string> {
  const props = hubspotCompany.properties || {};
  const domain = props.domain
    ? props.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    : null;
  const name = (props.name || "").trim() || domain || "";
  if (!name) throw new Error("No company name or domain");

  const companyData: Record<string, any> = {
    name,
    domain,
    industry: props.industry || null,
    hq_country: props.country || null,
    headcount: props.numberofemployees ? parseInt(String(props.numberofemployees), 10) || null : null,
    source_type: "inbound",
    hubspot_properties: props,
  };

  // Try to find existing by domain first
  if (domain) {
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("domain", domain)
      .maybeSingle();

    if (existing) {
      await supabase.from("companies").update(companyData).eq("id", existing.id);
      return existing.id;
    }
  }

  // Insert new company
  const { data: inserted, error } = await supabase.from("companies").insert(companyData).select("id").single();
  if (error) throw error;
  return inserted.id;
}

// Fetch contacts associated with a HubSpot company and save them
async function importContactsForCompany(supabase: any, hubspotCompanyId: string | number, companyId: string) {
  const apiKey = Deno.env.get("HUBSPOT_API_KEY");
  if (!apiKey) return;

  try {
    // Get associated contacts from HubSpot
    const res = await fetch(
      `https://api.hubapi.com/crm/v3/objects/companies/${hubspotCompanyId}/associations/contacts`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!res.ok) {
      const text = await res.text();
      console.warn(`Failed to fetch contacts for company ${hubspotCompanyId}: ${text}`);
      return;
    }

    const data = await res.json();
    const contactIds = (data.results || []).map((r: any) => r.toObjectId || r.id).filter(Boolean);

    if (contactIds.length === 0) return;

    // Fetch contact details via batch read API (avoids 414 URL-too-long errors)
    const allContactProps = await getAllContactPropertyNames(apiKey);
    const batchIds = contactIds.slice(0, 10);
    
    // Use HubSpot batch read API (POST) to fetch all properties
    const batchBody = {
      inputs: batchIds.map((cid: string) => ({ id: String(cid) })),
      properties: allContactProps.length > 0 ? allContactProps : ["firstname", "lastname", "email", "jobtitle", "hs_linkedin_url"],
    };
    
    let batchContacts: any[] = [];
    try {
      const batchRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/read", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(batchBody),
      });
      if (!batchRes.ok) {
        const errText = await batchRes.text();
        console.warn(`Batch contact read failed [${batchRes.status}]: ${errText.slice(0, 300)}`);
      } else {
        const batchData = await batchRes.json();
        batchContacts = batchData.results || [];
      }
    } catch (err: any) {
      console.warn(`Batch contact read error: ${err.message}`);
    }

    for (const contact of batchContacts) {
      const contactId = contact.id;
      try {
        const cp = contact.properties || {};
        const contactName = [cp.firstname, cp.lastname].filter(Boolean).join(" ").trim();
        if (!contactName) continue;

        let savedContactId: string | null = null;

        // Check if contact already exists for this company by email
        if (cp.email) {
          const { data: existing } = await supabase
            .from("contacts")
            .select("id")
            .eq("company_id", companyId)
            .eq("email", cp.email)
            .maybeSingle();

          if (existing) {
            // Update existing contact
            await supabase.from("contacts").update({
              name: contactName,
              title: cp.jobtitle || null,
              linkedin: cp.hs_linkedin_url || null,
              hubspot_properties: cp,
            }).eq("id", existing.id);
            savedContactId = existing.id;
          }
        }

        if (!savedContactId) {
          // Insert new contact
          const { data: inserted } = await supabase.from("contacts").insert({
            company_id: companyId,
            name: contactName,
            email: cp.email || null,
            title: cp.jobtitle || null,
            linkedin: cp.hs_linkedin_url || null,
            source: "hubspot",
            confidence: "high",
            hubspot_properties: cp,
          }).select("id").single();
          savedContactId = inserted?.id || null;
        }

        // Pull engagement timeline for this contact
        await importContactActivity(supabase, contactId, companyId, savedContactId, apiKey);
      } catch (err: any) {
        console.warn(`Failed to import contact ${contactId}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.warn(`Contact import error for company ${companyId}: ${err.message}`);
  }
}

// Fetch engagement/activity timeline for a HubSpot contact
async function importContactActivity(
  supabase: any,
  hubspotContactId: string | number,
  companyId: string,
  contactId: string | null,
  apiKey: string
) {
  try {
    // Fetch engagements associated with this contact (last 50)
    const engRes = await fetch(
      `https://api.hubapi.com/engagements/v1/engagements/associated/CONTACT/${hubspotContactId}/paged?limit=50`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!engRes.ok) {
      // Try the v3 timeline API as fallback
      const text = await engRes.text();
      console.warn(`Engagements API failed for contact ${hubspotContactId}: ${text}`);

      // Fallback: try web analytics events (page views)
      await importWebAnalyticsEvents(supabase, hubspotContactId, companyId, contactId, apiKey);
      return;
    }

    const engData = await engRes.json();
    const engagements = engData.results || [];

    for (const eng of engagements) {
      const e = eng.engagement || {};
      const meta = eng.metadata || {};
      const eventId = `eng_${e.id}`;

      const typeMap: Record<string, string> = {
        EMAIL: "EMAIL",
        MEETING: "MEETING",
        CALL: "CALL",
        TASK: "TASK",
        NOTE: "NOTE",
        INCOMING_EMAIL: "EMAIL_RECEIVED",
      };

      const activityType = typeMap[e.type] || e.type || "UNKNOWN";
      const title = meta.subject || meta.title || meta.body?.substring(0, 100) || `${activityType} engagement`;
      const occurredAt = e.timestamp ? new Date(e.timestamp).toISOString() : new Date().toISOString();

      // Upsert by hubspot_event_id
      const { error } = await supabase.from("customer_activity").upsert(
        {
          company_id: companyId,
          contact_id: contactId,
          activity_type: activityType,
          title,
          occurred_at: occurredAt,
          metadata: { source: "hubspot_engagement", engagement_type: e.type, ...meta },
          hubspot_event_id: eventId,
        },
        { onConflict: "hubspot_event_id" }
      );

      if (error) console.warn(`Failed to save engagement ${eventId}: ${error.message}`);
    }

    // Also try web analytics
    await importWebAnalyticsEvents(supabase, hubspotContactId, companyId, contactId, apiKey);
  } catch (err: any) {
    console.warn(`Activity import error for contact ${hubspotContactId}: ${err.message}`);
  }
}

// Fetch web analytics events (page views, form submissions) for a contact
async function importWebAnalyticsEvents(
  supabase: any,
  hubspotContactId: string | number,
  companyId: string,
  contactId: string | null,
  apiKey: string
) {
  try {
    // Get contact's recent page views via the contacts API timeline
    const timelineRes = await fetch(
      `https://api.hubapi.com/contacts/v1/contact/vid/${hubspotContactId}/profile?propertyMode=value_and_history&formSubmissionMode=all&showListMemberships=false`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    if (!timelineRes.ok) return;

    const profile = await timelineRes.json();

    // Extract form submissions
    const formSubs = profile["form-submissions"] || [];
    for (const fs of formSubs.slice(0, 20)) {
      const eventId = `form_${fs.timestamp || Date.now()}_${hubspotContactId}`;
      const title = fs.title || fs["form-id"] || "Form Submission";
      const url = fs["page-url"] || null;

      await supabase.from("customer_activity").upsert(
        {
          company_id: companyId,
          contact_id: contactId,
          activity_type: "FORM_SUBMISSION",
          title: `Form: ${title}`,
          url,
          occurred_at: fs.timestamp ? new Date(fs.timestamp).toISOString() : new Date().toISOString(),
          metadata: { source: "hubspot_form", form_id: fs["form-id"], page_title: fs.title },
          hubspot_event_id: eventId,
        },
        { onConflict: "hubspot_event_id" }
      );
    }

    // Extract identity profiles for signup source info
    const identities = profile["identity-profiles"] || [];
    for (const ip of identities) {
      for (const ident of (ip.identities || [])) {
        if (ident.type === "LEAD_STATUS" || ident.type === "EMAIL") continue;
        // Could log first-touch source etc.
      }
    }
  } catch (err: any) {
    console.warn(`Web analytics import error for contact ${hubspotContactId}: ${err.message}`);
  }
}
