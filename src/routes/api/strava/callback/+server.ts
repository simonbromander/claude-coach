import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabase } from "$lib/server/supabase";
import { exchangeCodeForTokens } from "$lib/server/strava";
import { PUBLIC_APP_URL } from "$env/static/public";

export const GET: RequestHandler = async ({ url }) => {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) {
    throw error(400, "Missing code");
  }

  if (!state) {
    throw error(400, "Missing state");
  }

  const { data, error: stateError } = await supabase
    .from("strava_oauth_state")
    .select("state")
    .eq("state", state)
    .maybeSingle();

  if (stateError) {
    throw error(500, stateError.message);
  }

  if (!data) {
    throw error(400, "Invalid state");
  }

  await supabase.from("strava_oauth_state").delete().eq("state", state);

  const origin = PUBLIC_APP_URL || url.origin;
  const redirectUri = new URL("/api/strava/callback", origin).toString();
  await exchangeCodeForTokens(code, redirectUri);

  throw redirect(302, "/builder?strava=connected");
};
