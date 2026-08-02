import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = await req.json();
    const query = String(payload?.query ?? "").trim();

    if (query.length < 4 || query.length > 250) {
      return json({ error: "Enter a fuller UK address or postcode." }, 400);
    }

    const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Location service is not configured." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: cached } = await admin
      .from("location_geocode_cache")
      .select("results,updated_at")
      .eq("normalized_query", normalizedQuery)
      .maybeSingle();

    const cacheFresh = cached?.updated_at
      ? Date.now() - new Date(cached.updated_at).getTime() < 30 * 24 * 60 * 60 * 1000
      : false;

    if (cached?.results && cacheFresh) {
      return json({ results: cached.results, cached: true });
    }

    const endpoint = new URL("https://nominatim.openstreetmap.org/search");
    endpoint.searchParams.set("q", query);
    endpoint.searchParams.set("format", "jsonv2");
    endpoint.searchParams.set("addressdetails", "1");
    endpoint.searchParams.set("limit", "5");
    endpoint.searchParams.set("countrycodes", "gb");

    const response = await fetch(endpoint, {
      headers: {
        "User-Agent": "Guestbook/1.0 (https://github.com/simplebusiness26/Guest-book-V3)",
        "Accept": "application/json",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });

    if (!response.ok) {
      return json({ error: "Address search is temporarily unavailable." }, 502);
    }

    const rawResults = await response.json();
    const results = (Array.isArray(rawResults) ? rawResults : [])
      .map((item: any) => {
        const address = item.address ?? {};
        const town =
          address.city ??
          address.town ??
          address.village ??
          address.municipality ??
          address.county ??
          "";

        return {
          id: String(item.place_id),
          label: String(item.display_name ?? query),
          address: String(item.display_name ?? query),
          town: String(town),
          postcode: String(address.postcode ?? ""),
          latitude: Number(item.lat),
          longitude: Number(item.lon),
        };
      })
      .filter((item: any) =>
        Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
      );

    await admin.from("location_geocode_cache").upsert({
      normalized_query: normalizedQuery,
      original_query: query,
      results,
      updated_at: new Date().toISOString(),
    });

    return json({ results, cached: false });
  } catch (error) {
    console.error(error);
    return json({ error: "The address could not be searched." }, 500);
  }
});
