import type { StravaActivity } from "../../strava/types.js";

export type SportKey = "swim" | "bike" | "run" | "other";

function sportFromStrava(type: string): SportKey {
  const normalized = type.toLowerCase();
  if (normalized.includes("swim")) return "swim";
  if (normalized.includes("ride") || normalized.includes("bike")) return "bike";
  if (normalized.includes("run")) return "run";
  return "other";
}

function weekKey(date: Date): string {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${temp.getUTCFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
}

export interface AssessmentInput {
  yearsInSport?: number | null;
  raceHistory?: string | null;
  constraints?: string | null;
  schedule?: string | null;
  goals?: string | null;
}

export interface AssessmentSummary {
  foundation: {
    raceHistory: string[];
    foundationLevel: string;
    yearsInSport?: number | null;
  };
  currentForm: {
    weeklyVolume: Record<string, number>;
    longestSessions: Record<string, { distanceKm?: number; durationMinutes?: number }>;
    consistency: string;
  };
  strengths: { sport: string; evidence: string }[];
  limiters: { sport: string; evidence: string }[];
  constraints: string[];
  patterns: {
    preferredLongRideDays: string[];
    preferredLongRunDays: string[];
  };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayNameFromDate(date: string): string {
  const d = new Date(date);
  return DAY_NAMES[d.getDay()] ?? "";
}

export function buildAssessment(
  activities: StravaActivity[],
  input: AssessmentInput
): AssessmentSummary {
  const weeklyTotals = new Map<string, Record<SportKey, number>>();
  const sportTotals: Record<SportKey, number> = { swim: 0, bike: 0, run: 0, other: 0 };
  const longestSessions: Record<SportKey, { distanceKm?: number; durationMinutes?: number }> = {
    swim: {},
    bike: {},
    run: {},
    other: {},
  };

  const longRideDays: Record<string, number> = {};
  const longRunDays: Record<string, number> = {};

  activities.forEach((activity) => {
    const sport = sportFromStrava(activity.sport_type);
    const date = new Date(activity.start_date);
    const week = weekKey(date);
    const hours = activity.moving_time / 3600;
    sportTotals[sport] += hours;

    if (!weeklyTotals.has(week)) {
      weeklyTotals.set(week, { swim: 0, bike: 0, run: 0, other: 0 });
    }
    weeklyTotals.get(week)![sport] += hours;

    const distanceKm = activity.distance / 1000;
    const durationMinutes = activity.moving_time / 60;

    if (
      !longestSessions[sport].distanceKm ||
      distanceKm > (longestSessions[sport].distanceKm ?? 0)
    ) {
      longestSessions[sport].distanceKm = Math.round(distanceKm * 10) / 10;
    }
    if (
      !longestSessions[sport].durationMinutes ||
      durationMinutes > (longestSessions[sport].durationMinutes ?? 0)
    ) {
      longestSessions[sport].durationMinutes = Math.round(durationMinutes);
    }

    if (sport === "bike" && durationMinutes >= 90) {
      const day = dayNameFromDate(activity.start_date);
      longRideDays[day] = (longRideDays[day] ?? 0) + 1;
    }

    if (sport === "run" && durationMinutes >= 60) {
      const day = dayNameFromDate(activity.start_date);
      longRunDays[day] = (longRunDays[day] ?? 0) + 1;
    }
  });

  const weeks = Array.from(weeklyTotals.values());
  const weekCount = Math.max(weeks.length, 1);
  const avgWeekly: Record<string, number> = {
    swim: Math.round((weeks.reduce((sum, w) => sum + w.swim, 0) / weekCount) * 10) / 10,
    bike: Math.round((weeks.reduce((sum, w) => sum + w.bike, 0) / weekCount) * 10) / 10,
    run: Math.round((weeks.reduce((sum, w) => sum + w.run, 0) / weekCount) * 10) / 10,
    total:
      Math.round(
        (weeks.reduce((sum, w) => sum + w.swim + w.bike + w.run + w.other, 0) / weekCount) * 10
      ) / 10,
  };

  const sortedWeeks = Array.from(weeklyTotals.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const recentWeeks = sortedWeeks.slice(0, 8);
  const consistencyRatio = recentWeeks.filter(
    ([_, w]) => w.swim + w.bike + w.run + w.other > 0
  ).length;
  const consistency = `${consistencyRatio}/${recentWeeks.length || 1} weeks active`;

  const strengths: { sport: string; evidence: string }[] = [];
  const limiters: { sport: string; evidence: string }[] = [];

  const sportEntries = [
    { sport: "swim", hours: avgWeekly.swim },
    { sport: "bike", hours: avgWeekly.bike },
    { sport: "run", hours: avgWeekly.run },
  ];

  const sortedSports = [...sportEntries].sort((a, b) => b.hours - a.hours);
  if (sortedSports[0].hours > 0) {
    strengths.push({
      sport: sortedSports[0].sport,
      evidence: `Highest average weekly volume (${sortedSports[0].hours} hrs)`,
    });
  }
  if (sortedSports[2].hours > 0 && sortedSports[2].hours < sortedSports[0].hours) {
    limiters.push({
      sport: sortedSports[2].sport,
      evidence: `Lowest recent volume (${sortedSports[2].hours} hrs)`,
    });
  }

  const preferredLongRideDays = Object.entries(longRideDays)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => day);

  const preferredLongRunDays = Object.entries(longRunDays)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => day);

  const foundationLevel =
    input.yearsInSport && input.yearsInSport >= 3 ? "intermediate" : "beginner";

  return {
    foundation: {
      raceHistory: input.raceHistory ? [input.raceHistory] : [],
      foundationLevel,
      yearsInSport: input.yearsInSport ?? null,
    },
    currentForm: {
      weeklyVolume: avgWeekly,
      longestSessions,
      consistency,
    },
    strengths,
    limiters,
    constraints: [input.constraints, input.schedule, input.goals].filter(
      (v): v is string => !!v && v.trim().length > 0
    ),
    patterns: {
      preferredLongRideDays,
      preferredLongRunDays,
    },
  };
}

export function summarizeActivities(activities: StravaActivity[], limit = 25) {
  return activities.slice(0, limit).map((activity) => ({
    date: activity.start_date.split("T")[0],
    sport: activity.sport_type,
    name: activity.name,
    durationMinutes: Math.round(activity.moving_time / 60),
    distanceKm: Math.round((activity.distance / 1000) * 10) / 10,
    averageHr: activity.average_heartrate,
    sufferScore: activity.suffer_score,
  }));
}
