import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireBuilderSecret } from "$lib/server/builder-auth";
import { buildAuthorizeUrl } from "$lib/server/strava";
import { supabase } from "$lib/server/supabase";
import { PUBLIC_APP_URL } from "$env/static/public";
import { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET } from "$env/static/private";

export const GET: RequestHandler = async ({ request }) => {
  requireBuilderSecret(request);

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    return json({ error: "Missing Strava credentials" }, { status: 500 });
  }

  const state = crypto.randomUUID();
  const { error } = await supabase.from("strava_oauth_state").insert({ state });
  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  const origin = PUBLIC_APP_URL || new URL(request.url).origin;
  const redirectUri = new URL("/api/strava/callback", origin).toString();
  const url = buildAuthorizeUrl({ redirectUri, state });

  return json({ url });
};
