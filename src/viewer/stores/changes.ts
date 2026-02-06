import { planData } from "./plan.js";
import {
  emptyPlanChanges,
  generateWorkoutId,
  getEffectiveWorkout,
  getWorkoutDate,
  isWorkoutDeleted,
  type PlanChanges,
} from "../../lib/plan-changes.js";

const storageKey = `plan-${planData.meta.id}-changes`;

export function emptyChanges(): PlanChanges {
  return emptyPlanChanges();
}

export function loadChanges(): PlanChanges {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return emptyPlanChanges();

  try {
    const parsed = JSON.parse(saved);
    return {
      moved: parsed.moved || {},
      edited: parsed.edited || {},
      deleted: parsed.deleted || [],
      added: parsed.added || {},
    };
  } catch {
    return emptyPlanChanges();
  }
}

export function saveChanges(changes: PlanChanges): void {
  localStorage.setItem(storageKey, JSON.stringify(changes));
}

export type { PlanChanges };
export { generateWorkoutId, getEffectiveWorkout, getWorkoutDate, isWorkoutDeleted };
