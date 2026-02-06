import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireBuilderSecret } from "$lib/server/builder-auth";

export const GET: RequestHandler = async ({ request }) => {
  requireBuilderSecret(request);
  return json({ ok: true });
};
