import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireBuilderSecret } from "$lib/server/builder-auth";
import { canReadActivities, fetchAthlete, getValidTokens } from "$lib/server/strava";

export const GET: RequestHandler = async ({ request }) => {
  requireBuilderSecret(request);

  const tokens = await getValidTokens();
  if (!tokens) {
    return json({ connected: false });
  }

  try {
    const athlete = await fetchAthlete(tokens);
    const canRead = await canReadActivities(tokens);
    if (!canRead) {
      return json({ connected: false, reason: "missing_activity_scope" });
    }
    return json({ connected: true, athlete });
  } catch (error) {
    return json({ connected: false, error: error instanceof Error ? error.message : "" });
  }
};
