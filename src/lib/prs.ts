// Personal records are derived from the logged entries (never a separate source
// of truth), so they can't drift. The data set is small (personal use), so we
// compute on the fly rather than maintaining a cache.
import { db } from '../db';
import type { StrengthEntry, WodResult, RxStatus, WodScoreType } from '../types';

// Epley estimated 1RM lets a heavy triple count as progress without a true single.
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface StrengthBest {
  movementId: string;
  movementName: string;
  topWeightKg: number; // heaviest single working set
  topReps: number;
  estimated1RM: number;
  date: string;
}

// Best (heaviest) set across all entries for a movement, plus best estimated 1RM.
export function bestStrengthFromEntries(
  entries: StrengthEntry[],
): { topWeightKg: number; topReps: number; estimated1RM: number } | null {
  let topWeightKg = -Infinity;
  let topReps = 0;
  let bestE1RM = -Infinity;
  for (const e of entries) {
    for (const s of e.sets) {
      if (s.weightKg == null) continue;
      if (s.weightKg > topWeightKg) {
        topWeightKg = s.weightKg;
        topReps = s.reps;
      }
      const e1 = estimate1RM(s.weightKg, s.reps);
      if (e1 > bestE1RM) bestE1RM = e1;
    }
  }
  if (topWeightKg === -Infinity) return null;
  return { topWeightKg, topReps, estimated1RM: bestE1RM };
}

export async function strengthBests(): Promise<StrengthBest[]> {
  const entries = await db.strengthEntries.toArray();
  const byMovement = new Map<string, StrengthEntry[]>();
  for (const e of entries) {
    const arr = byMovement.get(e.movementId) ?? [];
    arr.push(e);
    byMovement.set(e.movementId, arr);
  }
  const sessions = await db.sessions.toArray();
  const sessionDate = new Map(sessions.map((s) => [s.id, s.date]));

  const bests: StrengthBest[] = [];
  for (const [movementId, list] of byMovement) {
    const best = bestStrengthFromEntries(list);
    if (!best) continue;
    // date of the entry that holds the heaviest set
    let date = '';
    outer: for (const e of list) {
      for (const s of e.sets) {
        if (s.weightKg === best.topWeightKg && s.reps === best.topReps) {
          date = sessionDate.get(e.sessionId) ?? '';
          break outer;
        }
      }
    }
    bests.push({
      movementId,
      movementName: list[0].movementName,
      topWeightKg: best.topWeightKg,
      topReps: best.topReps,
      estimated1RM: best.estimated1RM,
      date,
    });
  }
  return bests.sort((a, b) => a.movementName.localeCompare(b.movementName));
}

// For Time → lower is better; everything else → higher is better.
export function isLowerBetter(scoreType: WodScoreType): boolean {
  return scoreType === 'forTime';
}

// A single comparable number for a WOD result.
export function wodResultValue(r: WodResult): number | null {
  switch (r.scoreType) {
    case 'forTime':
      return r.cappedOut ? null : r.durationSec; // capped attempts don't count as a time PR
    case 'amrap':
      return r.rounds != null ? r.rounds * 1000 + (r.extraReps ?? 0) : null;
    case 'load':
    case 'reps':
      return r.score;
    default:
      return null;
  }
}

export interface WodBest {
  wodId: string;
  wodName: string;
  scoreType: WodScoreType;
  rxStatus: RxStatus;
  value: number;
  result: WodResult;
}

// Best result per WOD, kept separate for Rx vs Scaled.
export async function wodBests(): Promise<WodBest[]> {
  const results = await db.wodResults.toArray();
  const byKey = new Map<string, WodBest>();
  for (const r of results) {
    const v = wodResultValue(r);
    if (v == null) continue;
    const key = `${r.wodId}|${r.rxStatus}`;
    const lower = isLowerBetter(r.scoreType);
    const cur = byKey.get(key);
    if (!cur || (lower ? v < cur.value : v > cur.value)) {
      byKey.set(key, {
        wodId: r.wodId,
        wodName: r.wodName,
        scoreType: r.scoreType,
        rxStatus: r.rxStatus,
        value: v,
        result: r,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.wodName.localeCompare(b.wodName));
}

// --- PR detection at save time (compares a candidate against existing history) ---

// Does a strength entry's heaviest set beat the movement's prior best weight?
export async function detectStrengthPR(entry: StrengthEntry): Promise<boolean> {
  const candidate = bestStrengthFromEntries([entry]);
  if (!candidate) return false;
  const prior = await db.strengthEntries
    .where('movementId')
    .equals(entry.movementId)
    .toArray();
  const priorOthers = prior.filter((e) => e.id !== entry.id);
  const priorBest = bestStrengthFromEntries(priorOthers);
  if (!priorBest) return true; // first time lifting this with weight
  return candidate.topWeightKg > priorBest.topWeightKg;
}

export async function detectWodPR(result: WodResult): Promise<boolean> {
  const v = wodResultValue(result);
  if (v == null) return false;
  const prior = await db.wodResults.where('wodId').equals(result.wodId).toArray();
  const lower = isLowerBetter(result.scoreType);
  let priorBest: number | null = null;
  for (const r of prior) {
    if (r.id === result.id || r.rxStatus !== result.rxStatus) continue;
    const rv = wodResultValue(r);
    if (rv == null) continue;
    if (priorBest == null || (lower ? rv < priorBest : rv > priorBest)) priorBest = rv;
  }
  if (priorBest == null) return true;
  return lower ? v < priorBest : v > priorBest;
}

export function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatWodScore(r: { scoreType: WodScoreType; durationSec: number | null; rounds: number | null; extraReps: number | null; score: number | null; cappedOut: boolean }): string {
  switch (r.scoreType) {
    case 'forTime':
      if (r.durationSec == null) return '—';
      return formatDuration(r.durationSec) + (r.cappedOut ? ' (capped)' : '');
    case 'amrap':
      if (r.rounds == null) return '—';
      return `${r.rounds} rds` + (r.extraReps ? ` + ${r.extraReps}` : '');
    case 'load':
      return r.score != null ? `${r.score} kg` : '—';
    case 'reps':
      return r.score != null ? `${r.score} reps` : '—';
    default:
      return '—';
  }
}
