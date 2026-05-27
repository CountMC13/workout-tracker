// 1RM stats are derived from the logged OneRepMax entries (never stored), so a
// re-logged or deleted entry instantly re-computes. Mirrors lib/prs.ts: small
// personal data set, computed on the fly. Plus a working-set % and plate-loading
// calculator (pure, no db).
import { db } from '../db';
import { estimate1RM } from './prs';
import { round1 } from './bmi';
import { PERCENT_STEPS, PLATE_SET_KG } from '../constants';
import type { OneRepMax } from '../types';

// Comparable 1RM value of one logged entry (Epley if reps>1, else the weight).
export function oneRepMaxValue(o: OneRepMax): number {
  return estimate1RM(o.weightKg, o.reps);
}

export interface OneRepMaxBest {
  liftId: string;
  liftName: string;
  best1RM: number; // max comparable value across the lift's entries
  bestWeightKg: number; // weight of the best entry
  bestReps: number;
  bestEstimated: boolean;
  bestDate: string;
  latest1RM: number; // comparable value of the most recent entry (by date, tie-break createdAt)
  latestDate: string;
}

// Best stats per lift, keyed by liftId. Lifts with no logged 1RM are absent from the map.
export async function oneRepMaxBests(): Promise<Map<string, OneRepMaxBest>> {
  const entries = await db.oneRepMaxes.toArray();
  const byLift = new Map<string, OneRepMax[]>();
  for (const o of entries) {
    const arr = byLift.get(o.liftId) ?? [];
    arr.push(o);
    byLift.set(o.liftId, arr);
  }

  const bests = new Map<string, OneRepMaxBest>();
  for (const [liftId, list] of byLift) {
    let best = list[0];
    let bestVal = oneRepMaxValue(best);
    let latest = list[0];
    for (const o of list) {
      const v = oneRepMaxValue(o);
      if (v > bestVal) {
        best = o;
        bestVal = v;
      }
      // most recent by date, tie-break createdAt
      if (o.date > latest.date || (o.date === latest.date && o.createdAt > latest.createdAt)) {
        latest = o;
      }
    }
    bests.set(liftId, {
      liftId,
      liftName: best.liftName,
      best1RM: round1(bestVal),
      bestWeightKg: best.weightKg,
      bestReps: best.reps,
      bestEstimated: best.estimated,
      bestDate: best.date,
      latest1RM: round1(oneRepMaxValue(latest)),
      latestDate: latest.date,
    });
  }
  return bests;
}

export interface TrendPoint { x: string; y: number; } // x = date 'YYYY-MM-DD', y = comparable 1RM

// All entries for a lift as chart points, ascending by date. For multiple entries
// on the same date, keep the highest value that day (one point per day).
export async function oneRepMaxHistory(liftId: string): Promise<TrendPoint[]> {
  const entries = await db.oneRepMaxes.where('liftId').equals(liftId).toArray();
  const byDate = new Map<string, number>();
  for (const o of entries) {
    const v = oneRepMaxValue(o);
    const cur = byDate.get(o.date);
    if (cur == null || v > cur) byDate.set(o.date, v);
  }
  return [...byDate.entries()]
    .map(([x, y]) => ({ x, y: round1(y) }))
    .sort((a, b) => a.x.localeCompare(b.x));
}

export interface PercentRow { percent: number; weightKg: number; } // weightKg rounded to nearest 2.5

// Round to the nearest loadable 2.5 kg increment.
function round2_5(v: number): number {
  return Math.round(v / 2.5) * 2.5;
}

// Working weight for an arbitrary percentage of a 1RM, rounded to the nearest
// loadable 2.5 kg. Shared by the % table and the logger's % calculator.
export function weightForPercent(oneRM: number, percent: number): number {
  return round2_5((oneRM * percent) / 100);
}

export function percentTable(oneRM: number): PercentRow[] {
  return PERCENT_STEPS.map((percent) => ({
    percent,
    weightKg: weightForPercent(oneRM, percent),
  }));
}

export interface PlateLoad {
  perSide: { plate: number; count: number }[]; // plates loaded on ONE side, heaviest first
  achievableKg: number; // bar + 2*sum(plates) — the closest loadable weight <= target
  leftoverKg: number; // target - achievableKg (>= 0), what couldn't be matched with available plates
}

// Greedy fill from PLATE_SET_KG. perSide load = (target - bar)/2. If target < bar,
// return empty perSide, achievableKg=bar.
export function platesFor(targetKg: number, barKg: number): PlateLoad {
  if (targetKg < barKg) {
    return { perSide: [], achievableKg: barKg, leftoverKg: round1(targetKg - barKg) };
  }
  let remaining = (targetKg - barKg) / 2;
  const perSide: { plate: number; count: number }[] = [];
  for (const plate of PLATE_SET_KG) {
    const count = Math.floor(remaining / plate);
    if (count > 0) {
      perSide.push({ plate, count });
      remaining -= count * plate;
    }
  }
  const loaded = perSide.reduce((sum, p) => sum + p.plate * p.count, 0);
  const achievableKg = round1(barKg + 2 * loaded);
  return { perSide, achievableKg, leftoverKg: round1(targetKg - achievableKg) };
}
