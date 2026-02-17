import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APOLLO_BASE = "https://api.apollo.io/api/v1";

const TITLE_KEYWORDS = [
  "enablement",
  "learning",
  "L&D",
  "training",
  "customer education",
  "partner enablement",
  "readiness",
  "sales enablement",
  "revenue enablement",
  "change management",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apolloKey = Deno.env.get("APOLLO_API_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!apolloKey) throw new Error("APOLLO_API_KEY not configured");

    const { company_id } = await req.json();
    if (!company_id) throw new Error("company_id is required");

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id, name, domain, partner, industry, persona")
      .eq("id", company_id)
      .maybeSingle();

    if (compErr) throw compErr;
    if (!company) throw new Error("Company not found");

    const partnerPlatform = company.partner || "unknown";

    console.log(`Apollo search for: ${company.name} (domain: ${company.domain})`);

    // Step 1: People API Search — find people by domain + title keywords (no credits used)
    const searchBody: Record<string, unknown> = {
      person_titles: TITLE_KEYWORDS,
      per_page: 10,
      page: 1,
    };

    if (company.domain) {
      searchBody.q_organization_domains_list = [company.domain];
    } else {
      searchBody.q_organization_name = company.name;
    }

    const searchResp = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apolloKey,
      },
      body: JSON.stringify(searchBody),
    });

    if (!searchResp.ok) {
      const errText = await searchResp.text();
      console.error(`Apollo search error: ${searchResp.status} ${errText}`);
      throw new Error(`Apollo People Search error: ${searchResp.status}`);
    }

    const searchResult = await searchResp.json();
    const people = searchResult.people || [];

    console.log(`Apollo found ${people.length} people for ${company.name}`);

    if (people.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          contacts_found: 0,
          contacts: [],
          company: company.name,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Enrich top contacts to get emails (up to 10 at a time via bulk)
    const toEnrich = people.slice(0, 10);
    const enrichDetails: Record<string, unknown>[] = [];

    // Use bulk enrichment for efficiency (max 10 per call)
    const bulkResp = await fetch(`${APOLLO_BASE}/people/bulk_match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apolloKey,
      },
      body: JSON.stringify({
        details: toEnrich.map((p: any) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          organization_name: p.organization?.name || company.name,
          domain: company.domain || undefined,
        })),
        reveal_personal_emails: false,
      }),
    });

    let enrichedPeople = toEnrich;
    if (bulkResp.ok) {
      const bulkResult = await bulkResp.json();
      if (bulkResult.matches && bulkResult.matches.length > 0) {
        enrichedPeople = bulkResult.matches;
      }
    } else {
      console.warn(`Apollo bulk enrichment failed: ${bulkResp.status}, using search results only`);
    }

    // Step 3: Upsert contacts
    let added = 0;
    const contactsOut: Record<string, unknown>[] = [];

    for (const p of enrichedPeople) {
      const name = p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim();
      if (!name) continue;

      const email = p.email || null;
      const linkedin = p.linkedin_url || null;
      const title = p.title || null;

      // Check if partner platform appears in their profile
      const hasPartner =
        partnerPlatform !== "unknown" &&
        JSON.stringify(p).toLowerCase().includes(partnerPlatform.toLowerCase());

      const reasoning = [
        title ? `Title: ${title}` : null,
        hasPartner ? `🟢 ${partnerPlatform} found in profile` : null,
        p.headline ? `Headline: ${p.headline}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const contactData = {
        company_id: company.id,
        name,
        title,
        email,
        linkedin,
        source: "apollo",
        confidence: email ? "high" : "medium",
        reasoning,
        updated_at: new Date().toISOString(),
      };

      // Upsert by company_id + email or name
      const matchCol = email ? "email" : "name";
      const matchVal = email || name;

      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", company.id)
        .eq(matchCol, matchVal)
        .maybeSingle();

      if (existing) {
        await supabase.from("contacts").update(contactData).eq("id", existing.id);
      } else {
        await supabase.from("contacts").insert(contactData);
      }

      added++;
      contactsOut.push({ name, title, email, linkedin, confidence: contactData.confidence });
    }

    // Update legacy buyer fields with top contact
    const top = enrichedPeople[0];
    if (top) {
      const topName = top.name || `${top.first_name || ""} ${top.last_name || ""}`.trim();
      await supabase
        .from("companies")
        .update({
          buyer_name: topName || null,
          buyer_title: top.title || null,
          buyer_email: top.email || null,
          buyer_linkedin: top.linkedin_url || null,
        })
        .eq("id", company_id);
    }

    console.log(`Saved ${added} Apollo contacts for ${company.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        contacts_found: added,
        contacts: contactsOut,
        company: company.name,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("find-contacts error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
