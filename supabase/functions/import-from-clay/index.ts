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
    let contactsAdded = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
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

        // Find or create company
        let companyId: string | null = null;

        if (cleanDomain) {
          const { data: existing } = await supabase
            .from("companies")
            .select("id")
            .eq("domain", cleanDomain)
            .maybeSingle();

          if (existing) {
            companyId = existing.id;
            // Update company metadata
            const companyUpdate: Record<string, any> = {};
            const industry = row.industry || row.Industry || null;
            const partner = row.partner || row.Partner || null;
            const hq_country = row.hq_country || row.country || row.Country || row["HQ Country"] || null;
            const headcount = row.headcount || row.Headcount || row["Employee Count"] || null;
            const persona = row.persona || row.Persona || null;
            if (industry) companyUpdate.industry = industry;
            if (partner) companyUpdate.partner = partner;
            if (hq_country) companyUpdate.hq_country = hq_country;
            if (headcount) companyUpdate.headcount = parseInt(String(headcount), 10) || null;
            if (persona) companyUpdate.persona = persona;
            if (Object.keys(companyUpdate).length > 0) {
              await supabase.from("companies").update(companyUpdate).eq("id", companyId);
            }
          } else {
            const { data: newCompany } = await supabase
              .from("companies")
              .insert({
                name: name.trim(),
                domain: cleanDomain,
                industry: row.industry || row.Industry || null,
                partner: row.partner || row.Partner || null,
                hq_country: row.hq_country || row.country || row.Country || row["HQ Country"] || null,
                headcount: (row.headcount || row.Headcount) ? parseInt(String(row.headcount || row.Headcount), 10) || null : null,
                persona: row.persona || row.Persona || null,
              })
              .select("id")
              .single();
            companyId = newCompany?.id || null;
          }
        } else {
          const { data: newCompany } = await supabase
            .from("companies")
            .insert({ name: name.trim() })
            .select("id")
            .single();
          companyId = newCompany?.id || null;
        }

        if (!companyId) {
          skipped++;
          continue;
        }

        imported++;

        // Handle contacts — support both single contact and array of contacts
        const contacts: Record<string, any>[] = row.contacts || row.Contacts || [];
        
        // If no contacts array, check for single contact fields
        if (contacts.length === 0) {
          const contactName = row.buyer_name || row["Buyer Name"] || row["Contact Name"] || row.contact_name || null;
          if (contactName) {
            contacts.push({
              name: contactName,
              title: row.buyer_title || row["Buyer Title"] || row["Contact Title"] || row.contact_title || null,
              email: row.buyer_email || row["Buyer Email"] || row["Contact Email"] || row.contact_email || row.email || null,
              linkedin: row.buyer_linkedin || row["Buyer LinkedIn"] || row["LinkedIn URL"] || row.linkedin || null,
              confidence: row.confidence || null,
              reasoning: row.reasoning || null,
            });
          }
        }

        // Upsert contacts
        for (const contact of contacts) {
          const contactName = contact.name || contact.Name || contact["Contact Name"] || null;
          if (!contactName) continue;

          const email = contact.email || contact.Email || contact["Contact Email"] || null;
          const contactData = {
            company_id: companyId,
            name: contactName,
            title: contact.title || contact.Title || contact["Job Title"] || null,
            email,
            linkedin: contact.linkedin || contact.LinkedIn || contact["LinkedIn URL"] || null,
            source: "clay",
            confidence: contact.confidence || null,
            reasoning: contact.reasoning || null,
            updated_at: new Date().toISOString(),
          };

          if (email) {
            // Upsert by company_id + email
            const { data: existing } = await supabase
              .from("contacts")
              .select("id")
              .eq("company_id", companyId)
              .eq("email", email)
              .maybeSingle();

            if (existing) {
              await supabase.from("contacts").update(contactData).eq("id", existing.id);
            } else {
              await supabase.from("contacts").insert(contactData);
            }
          } else {
            await supabase.from("contacts").insert(contactData);
          }
          contactsAdded++;
        }
      } catch (err: any) {
        errors.push(`Row "${row.name || row.company_name || "unknown"}": ${err.message}`);
        skipped++;
      }
    }

    console.log(`Clay import: ${imported} companies, ${contactsAdded} contacts, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        imported,
        contacts_added: contactsAdded,
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
