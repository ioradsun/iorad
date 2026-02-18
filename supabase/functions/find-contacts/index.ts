import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const APOLLO_BASE = "https://api.apollo.io/api/v1";

const TITLE_KEYWORDS = [
  "learning",
  "learning & development",
  "l&d",
  "enablement",
  "education",
  "customer ed",
  "gtm",
  "go to market",
  "go-to-market",
];

// Used to strictly filter returned contacts by title
function titleMatchesKeywords(title: string | null): boolean {
  if (!title) return false;
  const lower = title.toLowerCase();
  return TITLE_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// Persona-specific title keywords for targeted searches
const PERSONA_TITLES: Record<string, string[]> = {
  "Learning & Development": ["learning", "L&D", "learning & development", "instructional design", "talent development", "learning experience"],
  "Sales Enablement": ["sales enablement", "revenue enablement", "enablement", "go-to-market", "GTM"],
  "Revenue Enablement": ["revenue enablement", "enablement", "GTM", "go-to-market"],
  "Customer Education": ["customer education", "customer ed", "education", "enablement", "customer onboarding", "academy"],
  "Partner Enablement": ["partner enablement", "channel enablement", "enablement", "partner success"],
};

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

    const { company_id, persona, name_hint } = await req.json();
    if (!company_id) throw new Error("company_id is required");

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("id, name, domain, partner, industry, persona")
      .eq("id", company_id)
      .maybeSingle();

    if (compErr) throw compErr;
    if (!company) throw new Error("Company not found");

    const partnerPlatform = company.partner || "unknown";

    // Use persona-specific titles if provided, otherwise default keywords
    const searchPersona = persona || company.persona;
    const titleKeywords = (searchPersona && PERSONA_TITLES[searchPersona]) || TITLE_KEYWORDS;
    console.log(`Apollo search for: ${company.name} (domain: ${company.domain}, persona: ${searchPersona || "default"})`);

    // Helper: run Apollo People Search with given params
    async function apolloSearch(params: Record<string, unknown>, useTitles = true) {
      const searchParams: Record<string, unknown> = { per_page: 10, page: 1, ...params };
      if (useTitles) searchParams.person_titles = titleKeywords;
      const resp = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apolloKey! },
        body: JSON.stringify(searchParams),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`Apollo search error: ${resp.status} ${errText}`);
        throw new Error(`Apollo People Search error: ${resp.status}`);
      }
      const result = await resp.json();
      return result.people || [];
    }

    // Try domain first, then company name, then broader org search
    let people: any[] = [];

    // If a specific person name is provided, do a targeted person search first
    if (name_hint && company.domain) {
      people = await apolloSearch({
        q_organization_domains_list: [company.domain],
        q_person_name: name_hint.trim(),
      }, false);
      console.log(`Apollo name_hint search (${name_hint}): ${people.length} results`);
    }

    if (people.length === 0 && company.domain) {
      people = await apolloSearch({ q_organization_domains_list: [company.domain] });
      console.log(`Apollo domain search (${company.domain}): ${people.length} results`);
    }

    if (people.length === 0) {
      // Fallback: search by company name
      console.log(`Falling back to company name search: ${company.name}`);
      people = await apolloSearch({ q_organization_name: company.name });
      console.log(`Apollo name search (${company.name}): ${people.length} results`);
    }

    if (people.length === 0 && company.domain) {
      // Last resort: try without www/subdomain variations
      const baseDomain = company.domain.replace(/^www\./, "");
      const altDomains = [baseDomain];
      // Try common variations like companyname.com from the company name
      const nameDomain = company.name.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
      if (nameDomain !== baseDomain) altDomains.push(nameDomain);
      
      console.log(`Last resort: trying alternative domains: ${altDomains.join(", ")}`);
      people = await apolloSearch({ q_organization_domains_list: altDomains });
      console.log(`Apollo alt-domain search: ${people.length} results`);

      // If we found a better domain, update it on the company record
      if (people.length > 0 && people[0]?.organization?.primary_domain) {
        const correctDomain = people[0].organization.primary_domain;
        if (correctDomain !== company.domain) {
          console.log(`Updating company domain: ${company.domain} → ${correctDomain}`);
          await supabase.from("companies").update({ domain: correctDomain }).eq("id", company.id);
        }
      }
    }

    // Final fallback: search without title filters (broader — any senior person)
    if (people.length === 0) {
      console.log(`Broadening search: dropping title filters for ${company.name}`);
      const broadParams: Record<string, unknown> = company.domain
        ? { q_organization_domains_list: [company.domain] }
        : { q_organization_name: company.name };
      // Filter to senior people only
      broadParams.person_seniorities = ["vp", "director", "c_suite", "owner", "partner"];
      people = await apolloSearch(broadParams, false);
      console.log(`Apollo broad search (no titles): ${people.length} results`);

      // Auto-correct domain if found
      if (people.length > 0 && people[0]?.organization?.primary_domain) {
        const correctDomain = people[0].organization.primary_domain;
        if (correctDomain !== company.domain) {
          console.log(`Updating company domain: ${company.domain} → ${correctDomain}`);
          await supabase.from("companies").update({ domain: correctDomain }).eq("id", company.id);
        }
      }
    }

    console.log(`Apollo total found: ${people.length} people for ${company.name}`);

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

    // Step 3: Upsert contacts — strict title filter applied here
    const filteredPeople = enrichedPeople.filter((p: any) => titleMatchesKeywords(p.title));
    console.log(`Strict title filter: ${enrichedPeople.length} → ${filteredPeople.length} contacts pass`);
    let added = 0;
    const contactsOut: Record<string, unknown>[] = [];

    for (const p of filteredPeople) {
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

    // Update legacy buyer fields with top filtered contact
    const top = filteredPeople[0];
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
