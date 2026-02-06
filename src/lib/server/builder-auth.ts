import { error } from "@sveltejs/kit";
import { BUILDER_ACCESS_SECRET } from "$env/static/private";

function extractSecret(request: Request): string | null {
  const header = request.headers.get("x-builder-secret");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();
  return null;
}

export function requireBuilderSecret(request: Request): void {
  if (!BUILDER_ACCESS_SECRET) {
    throw error(500, "Missing BUILDER_ACCESS_SECRET");
  }

  const secret = extractSecret(request);
  if (!secret || secret !== BUILDER_ACCESS_SECRET) {
    throw error(401, "Unauthorized");
  }
}
