import { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } from "$env/static/private";
import { supabase } from "$lib/server/supabase";
import type { StravaActivity, StravaAthlete, StravaTokenResponse } from "../../strava/types.js";

const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete_id?: number | null;
}

export function buildAuthorizeUrl({
  redirectUri,
  state,
}: {
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", STRAVA_CLIENT_ID || "");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "activity:read_all");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("state", state);
  return url.toString();
}

async function requestTokens(body: Record<string, string>): Promise<StravaTokenResponse> {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    throw new Error("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Strava token request failed: ${text}`);
  }

  return response.json();
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<StoredTokens> {
  const data = await requestTokens({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  return saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete?.id,
  });
}

export async function refreshTokens(refreshToken: string): Promise<StoredTokens> {
  const data = await requestTokens({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  return saveTokens({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete?.id,
  });
}

export async function saveTokens(tokens: StoredTokens): Promise<StoredTokens> {
  const { error } = await supabase.from("strava_tokens").upsert(
    {
      id: "primary",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at,
      athlete_id: tokens.athlete_id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(error.message);
  return tokens;
}

export async function getStoredTokens(): Promise<StoredTokens | null> {
  const { data, error } = await supabase
    .from("strava_tokens")
    .select("access_token, refresh_token, expires_at, athlete_id")
    .eq("id", "primary")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
    athlete_id: data.athlete_id,
  };
}

function isExpiringSoon(expiresAt: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return expiresAt <= now + 60;
}

export async function getValidTokens(): Promise<StoredTokens | null> {
  const stored = await getStoredTokens();
  if (stored) {
    if (isExpiringSoon(stored.expires_at)) {
      return refreshTokens(stored.refresh_token);
    }
    return stored;
  }

  if (STRAVA_REFRESH_TOKEN) {
    return refreshTokens(STRAVA_REFRESH_TOKEN);
  }

  return null;
}

async function fetchWithRetry(url: string, accessToken: string, retries = 3): Promise<Response> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 429 && retries > 0) {
    const retryAfter = parseInt(response.headers.get("retry-after") || "60", 10);
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    return fetchWithRetry(url, accessToken, retries - 1);
  }

  if (!response.ok && retries > 0) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return fetchWithRetry(url, accessToken, retries - 1);
  }

  return response;
}

export async function fetchAthlete(tokens: StoredTokens): Promise<StravaAthlete> {
  const response = await fetchWithRetry(`${API_BASE}/athlete`, tokens.access_token);
  if (!response.ok) {
    throw new Error(`Failed to fetch athlete: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchActivities(
  tokens: StoredTokens,
  afterDate: Date
): Promise<StravaActivity[]> {
  const after = Math.floor(afterDate.getTime() / 1000);
  const activities: StravaActivity[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = new URL(`${API_BASE}/athlete/activities`);
    url.searchParams.set("after", after.toString());
    url.searchParams.set("page", page.toString());
    url.searchParams.set("per_page", perPage.toString());

    const response = await fetchWithRetry(url.toString(), tokens.access_token);
    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }

    const batch: StravaActivity[] = await response.json();
    activities.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return activities;
}
