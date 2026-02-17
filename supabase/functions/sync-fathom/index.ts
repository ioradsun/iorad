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

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const filterDomain = body.domain;
    const companyId = body.company_id;
    const limit = body.limit || 50;

    if (!filterDomain) throw new Error("domain is required — sync is per-company");

    // Domains to ignore when matching (your own org + personal email providers)
    const ignoredDomains = new Set([
      "iorad.com",
      "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
      "icloud.com", "aol.com", "protonmail.com",
    ]);

    // Fetch meetings from Fathom filtered to this company's domain, with transcript + summary
    const fathomUrl = `${FATHOM_API}/meetings?limit=${limit}&include_transcript=true&include_summary=true&include_action_items=true&calendar_invitees_domains[]=${encodeURIComponent(filterDomain)}`;
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
    console.log(`Fathom returned ${meetings.length} meetings for domain ${filterDomain}`);

    let synced = 0;
    const results: { meeting: string; action: string }[] = [];

    for (const meeting of meetings) {
      const meetingId = meeting.recording_id || meeting.id || meeting.meeting_id ||
        (meeting.url ? meeting.url.split("/").pop() : null);
      if (!meetingId) { console.warn("Skipping meeting with no id"); continue; }

      // Extract attendee emails, filtering out iorad and personal domains
      const attendees = meeting.calendar_invitees || meeting.attendees || [];
      const allEmails: string[] = attendees
        .map((a: any) => a.email || a)
        .filter((e: string) => typeof e === "string" && e.includes("@"));
      const externalEmails = allEmails.filter(
        (e) => !ignoredDomains.has(e.split("@")[1]?.toLowerCase())
      );

      const summary = meeting.summary?.overview || meeting.summary?.text || meeting.summary || null;
      const actionItems = meeting.action_items || [];
      const meetingDate = meeting.created_at || meeting.start_time || null;
      const duration = meeting.duration_seconds || meeting.duration || null;
      const fathomShareUrl = meeting.share_url || meeting.url || null;

      // Get transcript - inline from meetings endpoint or fetch separately
      let transcript = meeting.transcript || null;
      if (!transcript && meetingId) {
        try {
          const txResp = await fetch(`${FATHOM_API}/recordings/${meetingId}/transcript`, {
            headers: { "X-Api-Key": FATHOM_API_KEY },
          });
          if (txResp.ok) {
            const txData = await txResp.json();
            // Transcript can be an array of segments or a string
            if (Array.isArray(txData)) {
              transcript = txData.map((s: any) => `${s.speaker || "Speaker"}: ${s.text || s.content || ""}`).join("\n");
            } else if (typeof txData === "string") {
              transcript = txData;
            } else if (txData?.transcript) {
              transcript = typeof txData.transcript === "string" ? txData.transcript : JSON.stringify(txData.transcript);
            }
          } else {
            console.warn(`Transcript fetch failed for ${meetingId}: ${txResp.status}`);
          }
        } catch (txErr) {
          console.warn(`Transcript fetch error for ${meetingId}:`, txErr);
        }
      }
      // If transcript is an array (from inline), flatten it
      if (Array.isArray(transcript)) {
        transcript = transcript.map((s: any) => `${s.speaker || "Speaker"}: ${s.text || s.content || ""}`).join("\n");
      }

      const { error: upsertErr } = await sb
        .from("meetings")
        .upsert(
          {
            fathom_meeting_id: String(meetingId),
            company_id: companyId || null,
            title: meeting.title || meeting.meeting_title || "Untitled Meeting",
            meeting_date: meetingDate,
            duration_seconds: duration,
            summary: typeof summary === "string" ? summary : JSON.stringify(summary),
            action_items: actionItems,
            attendees: externalEmails,
            fathom_url: fathomShareUrl,
            transcript: typeof transcript === "string" ? transcript : null,
            synced_at: new Date().toISOString(),
          },
          { onConflict: "fathom_meeting_id" }
        );

      if (upsertErr) {
        console.warn(`Failed to upsert meeting ${meetingId}: ${upsertErr.message}`);
        continue;
      }

      synced++;
      results.push({ meeting: meeting.title || String(meetingId), action: "synced" });
    }

    console.log(`Synced ${synced} meetings for ${filterDomain}`);

    return new Response(
      JSON.stringify({ success: true, meetings_synced: synced, results }),
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
