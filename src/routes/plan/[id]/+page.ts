import type { PageLoad } from "./$types";
import { emptyPlanChanges } from "$lib/plan-changes";

export const load: PageLoad = async ({ fetch, params }) => {
  const res = await fetch(`/api/plan/${params.id}`);
  if (!res.ok) {
    return {
      planId: params.id,
      plan: null,
      changes: emptyPlanChanges(),
      completed: {},
      error: res.status === 404 ? "Plan not found" : "Failed to load plan",
    };
  }

  const data = await res.json();
  return {
    planId: params.id,
    plan: data.plan,
    changes: data.changes || emptyPlanChanges(),
    completed: data.completed || {},
    error: null,
  };
};
