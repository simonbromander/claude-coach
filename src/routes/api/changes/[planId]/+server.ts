import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabase } from "$lib/server/supabase";
import { emptyPlanChanges } from "$lib/plan-changes";

export const GET: RequestHandler = async ({ params }) => {
  const { planId } = params;

  const { data: changesRow, error: changesError } = await supabase
    .from("changes")
    .select("data")
    .eq("plan_id", planId)
    .maybeSingle();

  if (changesError) {
    return json({ error: changesError.message }, { status: 500 });
  }

  const changesPayload = changesRow?.data || {};

  return json({
    changes: changesPayload.changes || emptyPlanChanges(),
    completed: changesPayload.completed || {},
  });
};

export const PUT: RequestHandler = async ({ params, request }) => {
  const { planId } = params;
  const body = await request.json();

  const payload = {
    changes: body?.changes || emptyPlanChanges(),
    completed: body?.completed || {},
  };

  const { error } = await supabase.from("changes").upsert(
    {
      plan_id: planId,
      data: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "plan_id" }
  );

  if (error) {
    return json({ error: error.message }, { status: 500 });
  }

  return json({ success: true });
};
