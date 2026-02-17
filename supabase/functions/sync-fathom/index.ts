import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FATHOM_API = "https://api.fathom.ai/external/v1";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const FATHOM_API_KEY = Deno.env.get("FATHOM_API_KEY");
    if (!FATHOM_API_KEY) throw new Error("FATHOM_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Optional: filter by specific company domain
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const filterDomain = body.domain || null;
    const limit = body.limit || 50;

    // Fetch meetings from Fathom
    let fathomUrl = `${FATHOM_API}/meetings?limit=${limit}&include_summary=true&include_action_items=true`;
    if (filterDomain) {
      fathomUrl += `&calendar_invitees_domains[]=${encodeURIComponent(filterDomain)}`;
    }

    console.log(`Fetching Fathom meetings: ${fathomUrl}`);
    const fathomResp = await fetch(fathomUrl, {
      headers: { "X-Api-Key": FATHOM_API_KEY },
    });

    if (!fathomResp.ok) {
      const errText = await fathomResp.text();
      console.error(`Fathom API error ${fathomResp.status}:`, errText);
      throw new Error(`Fathom API returned ${fathomResp.status}`);
    }

    const fathomData = await fathomResp.json();
    const meetings = fathomData.items || [];
    console.log(`Fathom returned ${meetings.length} meetings`);

    // Load all companies for domain matching
    const { data: companies } = await sb.from("companies").select("id, name, domain");
    const domainToCompany = new Map<string, { id: string; name: string }>();
    for (const c of companies || []) {
      if (c.domain) {
        domainToCompany.set(c.domain.toLowerCase(), { id: c.id, name: c.name });
      }
    }

    let synced = 0;
    let companiesCreated = 0;
    const results: { meeting: string; company: string; action: string }[] = [];

    for (const meeting of meetings) {
      const meetingId = meeting.id || meeting.meeting_id;
      if (!meetingId) continue;

      // Extract attendee domains from calendar invitees
      const attendees = meeting.calendar_invitees || meeting.attendees || [];
      const attendeeEmails: string[] = attendees
        .map((a: any) => a.email || a)
        .filter((e: string) => typeof e === "string" && e.includes("@"));

      // Extract unique external domains (skip common personal email providers)
      const personalDomains = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "protonmail.com"]);
      const externalDomains = new Set<string>();
      for (const email of attendeeEmails) {
        const domain = email.split("@")[1]?.toLowerCase();
        if (domain && !personalDomains.has(domain)) {
          externalDomains.add(domain);
        }
      }

      // Try to match to a company
      let companyId: string | null = null;
      let companyName = "Unknown";

      for (const domain of externalDomains) {
        const match = domainToCompany.get(domain);
        if (match) {
          companyId = match.id;
          companyName = match.name;
          break;
        }
      }

      // If no match, create a new company from the first external domain
      if (!companyId && externalDomains.size > 0) {
        const newDomain = [...externalDomains][0];
        const newName = newDomain.split(".")[0].charAt(0).toUpperCase() + newDomain.split(".")[0].slice(1);

        const { data: newCompany, error: createErr } = await sb
          .from("companies")
          .insert({ name: newName, domain: newDomain })
          .select("id, name")
          .single();

        if (createErr) {
          console.warn(`Failed to create company for ${newDomain}: ${createErr.message}`);
        } else {
          companyId = newCompany.id;
          companyName = newCompany.name;
          domainToCompany.set(newDomain, { id: newCompany.id, name: newCompany.name });
          companiesCreated++;
          console.log(`Created company: ${newName} (${newDomain})`);
        }
      }

      // Build meeting summary and action items
      const summary = meeting.summary?.overview || meeting.summary?.text || meeting.summary || null;
      const actionItems = meeting.action_items || [];
      const meetingDate = meeting.created_at || meeting.start_time || null;
      const duration = meeting.duration_seconds || meeting.duration || null;
      const fathomUrl = meeting.share_url || meeting.url || null;

      // Upsert meeting
      const { error: upsertErr } = await sb
        .from("meetings")
        .upsert(
          {
            fathom_meeting_id: String(meetingId),
            company_id: companyId,
            title: meeting.title || meeting.meeting_title || "Untitled Meeting",
            meeting_date: meetingDate,
            duration_seconds: duration,
            summary: typeof summary === "string" ? summary : JSON.stringify(summary),
            action_items: actionItems,
            attendees: attendeeEmails,
            fathom_url: fathomUrl,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "fathom_meeting_id" }
        );

      if (upsertErr) {
        console.warn(`Failed to upsert meeting ${meetingId}: ${upsertErr.message}`);
        continue;
      }

      synced++;
      results.push({
        meeting: meeting.title || meetingId,
        company: companyName,
        action: companyId ? "linked" : "unlinked",
      });
    }

    console.log(`Synced ${synced} meetings, created ${companiesCreated} new companies`);

    return new Response(
      JSON.stringify({
        success: true,
        meetings_synced: synced,
        companies_created: companiesCreated,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("sync-fathom error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
