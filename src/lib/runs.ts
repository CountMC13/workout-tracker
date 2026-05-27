// Running stats are derived from the logged RunEntry rows (never stored), mirroring
// lib/prs.ts: small personal data set, computed on the fly. Distance is always stored
// in km; pace and display formatting convert to the user's unit on read.
import { db } from '../db';
import { currentWeekKeys } from './dates';
import type { RunEntry, UnitSystem } from '../types';

export const KM_PER_MILE = 1.609344;

// Pace in seconds per km. null when there's no distance to divide by.
export function paceSecPerKm(run: RunEntry): number | null {
  if (run.distanceKm <= 0) return null;
  return run.durationSec / run.distanceKm;
}

function mmss(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  // carry a rounded-up 60s
  const mm = s === 60 ? m + 1 : m;
  const ss = s === 60 ? 0 : s;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

// "m:ss /km" (metric) or "m:ss /mi" (imperial — converts the per-km pace to per-mile).
export function formatPace(secPerKm: number, units: UnitSystem): string {
  if (units === 'imperial') return `${mmss(secPerKm * KM_PER_MILE)} /mi`;
  return `${mmss(secPerKm)} /km`;
}

// "5.0 km" (metric, 1 dp) or "3.11 mi" (imperial, 2 dp).
export function formatDistance(km: number, units: UnitSystem): string {
  if (units === 'imperial') return `${(km / KM_PER_MILE).toFixed(2)} mi`;
  return `${km.toFixed(1)} km`;
}

// "h:mm:ss" once a run passes an hour, else "m:ss". Runs get long, so support hours
// (unlike prs.formatDuration, which is m:ss only).
export function formatRunDuration(totalSec: number): string {
  const t = Math.round(totalSec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface RunningBests {
  longest: { km: number; run: RunEntry } | null; // max distanceKm
  bestPace: { secPerKm: number; run: RunEntry } | null; // min pace among runs >= 1km
  // Best (lowest) time at standard distances; a run qualifies if within ±5% of the bucket.
  benchmarks: { label: string; distanceKm: number; durationSec: number; run: RunEntry }[];
}

const BENCHMARKS: { label: string; km: number }[] = [
  { label: '1K', km: 1 },
  { label: '5K', km: 5 },
  { label: '10K', km: 10 },
];

export async function runningBests(): Promise<RunningBests> {
  const runs = await db.runs.toArray();

  let longest: RunningBests['longest'] = null;
  let bestPace: RunningBests['bestPace'] = null;
  for (const run of runs) {
    if (run.distanceKm > 0 && (!longest || run.distanceKm > longest.km)) {
      longest = { km: run.distanceKm, run };
    }
    if (run.distanceKm >= 1) {
      const p = paceSecPerKm(run);
      if (p != null && (!bestPace || p < bestPace.secPerKm)) bestPace = { secPerKm: p, run };
    }
  }

  const benchmarks: RunningBests['benchmarks'] = [];
  for (const b of BENCHMARKS) {
    const lo = b.km * 0.95;
    const hi = b.km * 1.05;
    let best: RunEntry | null = null;
    for (const run of runs) {
      if (run.distanceKm >= lo && run.distanceKm <= hi && run.durationSec > 0) {
        if (!best || run.durationSec < best.durationSec) best = run;
      }
    }
    if (best) {
      benchmarks.push({ label: b.label, distanceKm: b.km, durationSec: best.durationSec, run: best });
    }
  }

  return { longest, bestPace, benchmarks };
}

// Total distance (km) of runs dated within the current calendar week (Mon–Sun).
export async function currentWeekDistanceKm(): Promise<number> {
  const weekKeys = new Set(currentWeekKeys().map((d) => d.key));
  const runs = await db.runs.toArray();
  return runs.reduce((sum, r) => (weekKeys.has(r.date) ? sum + r.distanceKm : sum), 0);
}
