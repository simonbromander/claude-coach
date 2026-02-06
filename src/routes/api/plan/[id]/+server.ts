import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabase } from "$lib/server/supabase";
import { emptyPlanChanges } from "$lib/plan-changes";

export const GET: RequestHandler = async ({ params }) => {
  const { id } = params;

  const { data: planRow, error: planError } = await supabase
    .from("plans")
    .select("data")
    .eq("id", id)
    .maybeSingle();

  if (planError) {
    return json({ error: planError.message }, { status: 500 });
  }

  if (!planRow) {
    return json({ error: "Plan not found" }, { status: 404 });
  }

  const { data: changesRow, error: changesError } = await supabase
    .from("changes")
    .select("data")
    .eq("plan_id", id)
    .maybeSingle();

  if (changesError) {
    return json({ error: changesError.message }, { status: 500 });
  }

  const changesPayload = changesRow?.data || {};

  return json({
    plan: planRow.data,
    changes: changesPayload.changes || emptyPlanChanges(),
    completed: changesPayload.completed || {},
  });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const { id } = params;
  const body = await request.json();

  if (!body?.plan) {
    return json({ error: "Missing plan" }, { status: 400 });
  }

  const { error } = await supabase.from("plans").upsert(
    {
      id,
      data: body.plan,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json({ success: true });
};
