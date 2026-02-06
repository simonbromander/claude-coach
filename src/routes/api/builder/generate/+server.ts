import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { requireBuilderSecret } from "$lib/server/builder-auth";
import { COACH_SYSTEM_PROMPT, JSON_REPAIR_PROMPT } from "$lib/server/prompt";
import { createClaudeMessage } from "$lib/server/anthropic";
import { buildAssessment, summarizeActivities } from "$lib/server/assessment";
import {
  fetchActivities,
  fetchAthlete,
  getValidTokens,
  StravaUnauthorizedError,
} from "$lib/server/strava";
import { supabase } from "$lib/server/supabase";
import { STRAVA_SYNC_DAYS, ANTHROPIC_MODEL } from "$env/static/private";
import { env as privateEnv } from "$env/dynamic/private";

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function nextMonday(date: Date): Date {
  const day = date.getDay();
  const offset = (8 - day) % 7 || 7;
  const next = new Date(date);
  next.setDate(date.getDate() + offset);
  return next;
}

function weeksBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
}

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON found in Claude response");
    return JSON.parse(text.slice(start, end + 1));
  }
}

async function repairJson({ raw, error }: { raw: string; error: string }): Promise<string> {
  return createClaudeMessage({
    system: JSON_REPAIR_PROMPT,
    messages: [
      {
        role: "user",
        content: `Error: ${error}\n\nFix this JSON:\n${raw}`,
      },
    ],
    model: ANTHROPIC_MODEL,
    maxTokens: Number(privateEnv.ANTHROPIC_REPAIR_MAX_TOKENS || 4000),
    timeoutMs: Number(privateEnv.ANTHROPIC_TIMEOUT_MS || 55000),
  });
}

export const POST: RequestHandler = async ({ request }) => {
  requireBuilderSecret(request);
  const startedAt = Date.now();
  console.log("builder.generate start");

  try {
    const body = await request.json();
    const { event, athlete, constraints, preferences } = body || {};

    if (!event?.name || !event?.date) {
      return json({ error: "Missing event name or date" }, { status: 400 });
    }

    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) {
      return json({ error: "Invalid event date" }, { status: 400 });
    }

    const today = new Date();
    const planStart = nextMonday(today);
    if (eventDate.getTime() <= planStart.getTime()) {
      return json({ error: "Event date must be after the plan start date" }, { status: 400 });
    }

    const tokens = await getValidTokens();
    if (!tokens) {
      return json({ error: "Strava not connected" }, { status: 400 });
    }

    const syncDays = Number(STRAVA_SYNC_DAYS || 730);
    const maxActivities = Number(privateEnv.STRAVA_MAX_ACTIVITIES || 1500);
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - syncDays);

    const [athleteProfile, activities] = await Promise.all([
      fetchAthlete(tokens),
      fetchActivities(tokens, afterDate, { maxActivities }),
    ]);
    console.log("builder.generate strava", {
      activities: activities.length,
      tookMs: Date.now() - startedAt,
    });

    const assessment = buildAssessment(activities, {
      yearsInSport: athlete?.yearsInSport ?? null,
      raceHistory: athlete?.raceHistory ?? null,
      constraints: constraints?.injuries ?? null,
      schedule: constraints?.schedule ?? null,
      goals: event?.goal ?? null,
    });

    const payload = {
      event: {
        name: event.name,
        date: event.date,
        type: event.type ?? "",
        goal: event.goal ?? "",
      },
      athlete: {
        name: athlete?.name ?? `${athleteProfile.firstname} ${athleteProfile.lastname}`,
        yearsInSport: athlete?.yearsInSport ?? null,
        raceHistory: athlete?.raceHistory ?? "",
      },
      constraints: {
        injuries: constraints?.injuries ?? "",
        schedule: constraints?.schedule ?? "",
        notes: constraints?.notes ?? "",
      },
      preferences,
      plan: {
        startDate: toISODate(planStart),
        endDate: toISODate(eventDate),
        totalWeeks: weeksBetween(planStart, eventDate),
      },
      assessment,
      recentActivities: summarizeActivities(activities),
    };

    const responseText = await createClaudeMessage({
      system: COACH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
      model: ANTHROPIC_MODEL,
      maxTokens: Number(privateEnv.ANTHROPIC_MAX_TOKENS || 8000),
      timeoutMs: Number(privateEnv.ANTHROPIC_TIMEOUT_MS || 55000),
    });
    console.log("builder.generate claude", { tookMs: Date.now() - startedAt });

    let plan: any;
    try {
      plan = extractJson(responseText);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON";
      console.warn("builder.generate json invalid, attempting repair", { message });
      const repaired = await repairJson({ raw: responseText, error: message });
      plan = extractJson(repaired);
    }

    const planId = plan?.meta?.id || `plan-${Date.now()}`;
    plan.meta = {
      ...plan.meta,
      id: planId,
      event: event.name,
      eventDate: event.date,
      planStartDate: toISODate(planStart),
      planEndDate: toISODate(eventDate),
      totalWeeks: plan.weeks?.length ?? payload.plan.totalWeeks,
      generatedAt: new Date().toISOString(),
    };

    if (!plan.preferences && preferences) {
      plan.preferences = preferences;
    }

    const { error } = await supabase.from("plans").upsert(
      {
        id: planId,
        data: plan,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      return json({ error: error.message }, { status: 500 });
    }

    console.log("builder.generate saved", { planId, tookMs: Date.now() - startedAt });
    return json({ planId });
  } catch (err) {
    console.error("builder.generate failed", err);
    if (err instanceof StravaUnauthorizedError) {
      return json(
        {
          error:
            "Strava authorization missing activity scope. Click Connect Strava to re-authorize.",
        },
        { status: 401 }
      );
    }

    const message = err instanceof Error ? err.message : "Internal error";
    return json({ error: message }, { status: 500 });
  }
};
