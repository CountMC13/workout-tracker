import Dexie, { type Table } from 'dexie';
import type {
  Exercise,
  VideoFile,
  Completion,
  Profile,
  WeightEntry,
  Movement,
  Wod,
  WorkoutSession,
  StrengthEntry,
  StrengthSet,
  WodResult,
  TrackedLift,
  OneRepMax,
  RunEntry,
} from './types';
import { MOVEMENTS_SEED, WODS_SEED } from './seed/library';
import { DEFAULT_TRACKED_LIFTS, MAX_TRACKED_LIFTS } from './constants';

class PhysioDB extends Dexie {
  exercises!: Table<Exercise, string>;
  videos!: Table<VideoFile, string>;
  completions!: Table<Completion, string>;
  // --- v2: workout + body metrics ---
  profile!: Table<Profile, string>;
  weights!: Table<WeightEntry, string>;
  movements!: Table<Movement, string>;
  wods!: Table<Wod, string>;
  sessions!: Table<WorkoutSession, string>;
  strengthEntries!: Table<StrengthEntry, string>;
  wodResults!: Table<WodResult, string>;
  // --- v3: 1RM tracking + running ---
  trackedLifts!: Table<TrackedLift, string>;
  oneRepMaxes!: Table<OneRepMax, string>;
  runs!: Table<RunEntry, string>;

  constructor() {
    super('PhysioTrackerDB');
    // v1 — DO NOT EDIT. Carried forward automatically by v2.
    this.version(1).stores({
      // *muscleGroups = multi-entry index for fast filtering by tag
      exercises: 'id, name, order, createdAt, *muscleGroups',
      videos: 'id, createdAt',
      completions: 'id, exerciseId, date, [exerciseId+date]',
    });
    // v2 — additive only. No upgrade callback: existing physio rows are untouched.
    this.version(2).stores({
      profile: 'id',
      weights: 'id, date',
      movements: 'id, name, category',
      wods: 'id, name, classification',
      sessions: 'id, date, createdAt',
      strengthEntries: 'id, sessionId, movementId, [sessionId+order]',
      wodResults: 'id, sessionId, wodId, date, [wodId+rxStatus]',
    });
    // v3 — additive only. No upgrade callback: existing v1/v2 rows are untouched.
    this.version(3).stores({
      trackedLifts: 'id, order',
      oneRepMaxes: 'id, liftId, date, [liftId+date]',
      runs: 'id, date, createdAt',
    });
  }
}

export const db = new PhysioDB();

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// --- Exercise operations ---

export async function createExercise(
  data: Omit<Exercise, 'id' | 'order' | 'createdAt'>,
): Promise<string> {
  const id = newId();
  const count = await db.exercises.count();
  await db.exercises.add({ ...data, id, order: count, createdAt: Date.now() });
  return id;
}

export async function updateExercise(
  id: string,
  data: Partial<Omit<Exercise, 'id'>>,
): Promise<void> {
  await db.exercises.update(id, data);
}

export async function deleteExercise(id: string): Promise<void> {
  await db.transaction('rw', db.exercises, db.completions, db.videos, async () => {
    const ex = await db.exercises.get(id);
    if (ex?.videoId) await db.videos.delete(ex.videoId);
    await db.completions.where('exerciseId').equals(id).delete();
    await db.exercises.delete(id);
  });
}

// --- Video operations ---

export async function saveVideo(file: File): Promise<string> {
  const id = newId();
  await db.videos.add({
    id,
    name: file.name,
    mimeType: file.type || 'video/mp4',
    blob: file,
    createdAt: Date.now(),
  });
  return id;
}

export async function replaceVideo(exerciseId: string, file: File): Promise<string> {
  const ex = await db.exercises.get(exerciseId);
  const newVideoId = await saveVideo(file);
  if (ex?.videoId) await db.videos.delete(ex.videoId);
  await db.exercises.update(exerciseId, { videoId: newVideoId });
  return newVideoId;
}

export async function removeVideo(exerciseId: string): Promise<void> {
  const ex = await db.exercises.get(exerciseId);
  if (ex?.videoId) await db.videos.delete(ex.videoId);
  await db.exercises.update(exerciseId, { videoId: null });
}

// --- Completion operations ---

export async function toggleCompletion(exerciseId: string, date: string): Promise<boolean> {
  const existing = await db.completions
    .where('[exerciseId+date]')
    .equals([exerciseId, date])
    .first();
  if (existing) {
    await db.completions.delete(existing.id);
    return false;
  }
  await db.completions.add({ id: newId(), exerciseId, date, createdAt: Date.now() });
  return true;
}

export async function isCompletedOn(exerciseId: string, date: string): Promise<boolean> {
  const existing = await db.completions
    .where('[exerciseId+date]')
    .equals([exerciseId, date])
    .first();
  return !!existing;
}

// ===================================================================
// Profile + body metrics
// ===================================================================

const DEFAULT_PROFILE: Omit<Profile, 'updatedAt'> = {
  id: 'me',
  heightCm: null,
  units: 'metric',
  sex: 'unspecified',
  birthYear: null,
  goalWeightKg: null,
  restSec: 120,
  lastBackupAt: null,
  weeklyRunGoalKm: null,
  barWeightKg: 20,
};

export async function getProfile(): Promise<Profile> {
  const existing = await db.profile.get('me');
  // Spread DEFAULT_PROFILE first so a profile saved before v3 picks up the new
  // fields (weeklyRunGoalKm, barWeightKg) without a migration callback.
  if (existing) return { ...DEFAULT_PROFILE, ...existing };
  const fresh: Profile = { ...DEFAULT_PROFILE, updatedAt: Date.now() };
  await db.profile.put(fresh);
  return fresh;
}

export async function updateProfile(patch: Partial<Omit<Profile, 'id'>>): Promise<void> {
  await getProfile(); // ensure the row exists
  await db.profile.update('me', { ...patch, updatedAt: Date.now() });
}

// One weight entry per day: re-logging the same day updates it.
export async function upsertWeight(date: string, weightKg: number, note = ''): Promise<void> {
  const existing = await db.weights.where('date').equals(date).first();
  const now = Date.now();
  if (existing) {
    await db.weights.update(existing.id, { weightKg, note, updatedAt: now });
  } else {
    await db.weights.add({ id: newId(), date, weightKg, note, createdAt: now, updatedAt: now });
  }
}

export async function deleteWeight(id: string): Promise<void> {
  await db.weights.delete(id);
}

// ===================================================================
// Movement + WOD libraries
// ===================================================================

export async function seedMovements(): Promise<number> {
  if ((await db.movements.count()) > 0) return 0;
  const now = Date.now();
  await db.movements.bulkAdd(
    MOVEMENTS_SEED.map((m) => ({ ...m, id: newId(), createdAt: now })),
  );
  return MOVEMENTS_SEED.length;
}

export async function seedWods(): Promise<number> {
  if ((await db.wods.count()) > 0) return 0;
  const now = Date.now();
  await db.wods.bulkAdd(WODS_SEED.map((w) => ({ ...w, id: newId(), createdAt: now })));
  return WODS_SEED.length;
}

// Find a movement by name (case-insensitive) or create it on the fly.
export async function ensureMovement(name: string, category = 'Other'): Promise<Movement> {
  const trimmed = name.trim();
  const existing = await db.movements.where('name').equalsIgnoreCase(trimmed).first();
  if (existing) return existing;
  const m: Movement = { id: newId(), name: trimmed, category, createdAt: Date.now() };
  await db.movements.add(m);
  return m;
}

export async function createWod(data: Omit<Wod, 'id' | 'createdAt'>): Promise<string> {
  const id = newId();
  await db.wods.add({ ...data, id, createdAt: Date.now() });
  return id;
}

export async function updateWod(id: string, patch: Partial<Omit<Wod, 'id'>>): Promise<void> {
  await db.wods.update(id, patch);
}

export async function deleteWod(id: string): Promise<void> {
  await db.transaction('rw', db.wods, db.wodResults, async () => {
    await db.wodResults.where('wodId').equals(id).delete();
    await db.wods.delete(id);
  });
}

// ===================================================================
// Workout sessions + strength entries
// ===================================================================

export async function getOrCreateSession(date: string): Promise<WorkoutSession> {
  const existing = await db.sessions.where('date').equals(date).first();
  if (existing) return existing;
  const now = Date.now();
  const s: WorkoutSession = { id: newId(), date, type: '', notes: '', createdAt: now, updatedAt: now };
  await db.sessions.add(s);
  return s;
}

export async function updateSession(
  id: string,
  patch: Partial<Omit<WorkoutSession, 'id'>>,
): Promise<void> {
  await db.sessions.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteSession(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.strengthEntries, db.wodResults, async () => {
    await db.strengthEntries.where('sessionId').equals(id).delete();
    await db.wodResults.where('sessionId').equals(id).delete();
    await db.sessions.delete(id);
  });
}

export async function addStrengthEntry(sessionId: string, movement: Movement): Promise<string> {
  const order = await db.strengthEntries.where('sessionId').equals(sessionId).count();
  const defaultSet: StrengthSet = { reps: 5, weightKg: null, done: false };
  const entry: StrengthEntry = {
    id: newId(),
    sessionId,
    movementId: movement.id,
    movementName: movement.name,
    order,
    sets: [defaultSet],
    felt: null,
    notes: '',
  };
  await db.strengthEntries.add(entry);
  return entry.id;
}

export async function updateStrengthEntry(
  id: string,
  patch: Partial<Pick<StrengthEntry, 'sets' | 'felt' | 'notes'>>,
): Promise<void> {
  await db.strengthEntries.update(id, patch);
}

export async function removeStrengthEntry(id: string): Promise<void> {
  await db.strengthEntries.delete(id);
}

// Re-insert a previously removed entry, keeping its original id/order (for undo).
export async function restoreStrengthEntry(entry: StrengthEntry): Promise<void> {
  await db.strengthEntries.put(entry);
}

// Clone the most recent prior session's strength entries into a target session.
export async function copyLastStrengthInto(targetSessionId: string, targetDate: string): Promise<number> {
  const prior = await db.sessions
    .where('date')
    .below(targetDate)
    .reverse()
    .sortBy('date');
  for (const s of prior) {
    const entries = await db.strengthEntries.where('sessionId').equals(s.id).sortBy('order');
    if (entries.length) {
      let order = await db.strengthEntries.where('sessionId').equals(targetSessionId).count();
      for (const e of entries) {
        await db.strengthEntries.add({
          ...e,
          id: newId(),
          sessionId: targetSessionId,
          order: order++,
          sets: e.sets.map((set) => ({ ...set, done: false })),
        });
      }
      return entries.length;
    }
  }
  return 0;
}

// ===================================================================
// WOD results
// ===================================================================

export interface WodResultInput {
  wodId: string;
  wodName: string;
  date: string;
  scoreType: WodResult['scoreType'];
  rxStatus: WodResult['rxStatus'];
  durationSec?: number | null;
  rounds?: number | null;
  extraReps?: number | null;
  score?: number | null;
  cappedOut?: boolean;
  notes?: string;
}

export async function logWodResult(input: WodResultInput): Promise<string> {
  const session = await getOrCreateSession(input.date);
  const id = newId();
  const result: WodResult = {
    id,
    sessionId: session.id,
    wodId: input.wodId,
    wodName: input.wodName,
    date: input.date,
    scoreType: input.scoreType,
    rxStatus: input.rxStatus,
    durationSec: input.durationSec ?? null,
    rounds: input.rounds ?? null,
    extraReps: input.extraReps ?? null,
    score: input.score ?? null,
    cappedOut: input.cappedOut ?? false,
    notes: input.notes ?? '',
    createdAt: Date.now(),
  };
  await db.wodResults.add(result);
  return id;
}

export async function deleteWodResult(id: string): Promise<void> {
  await db.wodResults.delete(id);
}

// Re-insert a previously removed WOD result (for undo).
export async function restoreWodResult(result: WodResult): Promise<void> {
  await db.wodResults.put(result);
}

// ===================================================================
// v3: tracked lifts + 1RM log
// ===================================================================

// Seed the default 6 tracked lifts on first load (idempotent, like seedMovements).
export async function seedTrackedLifts(): Promise<number> {
  if ((await db.trackedLifts.count()) > 0) return 0;
  const now = Date.now();
  await db.trackedLifts.bulkAdd(
    DEFAULT_TRACKED_LIFTS.map((name, i) => ({
      id: newId(),
      name,
      order: i,
      movementId: null,
      createdAt: now,
    })),
  );
  return DEFAULT_TRACKED_LIFTS.length;
}

// Add a tracked lift. Returns the new id, or null if the name is blank or the
// MAX_TRACKED_LIFTS cap is reached (the UI hides Add at the cap, this is a guard).
export async function addTrackedLift(
  name: string,
  movementId: string | null = null,
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const count = await db.trackedLifts.count();
  if (count >= MAX_TRACKED_LIFTS) return null;
  const id = newId();
  await db.trackedLifts.add({ id, name: trimmed, order: count, movementId, createdAt: Date.now() });
  return id;
}

export async function renameTrackedLift(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.trackedLifts.update(id, { name: trimmed });
}

// Remove a tracked lift and its logged 1RM history (matches deleteWod's cascade).
export async function removeTrackedLift(id: string): Promise<void> {
  await db.transaction('rw', db.trackedLifts, db.oneRepMaxes, async () => {
    await db.oneRepMaxes.where('liftId').equals(id).delete();
    await db.trackedLifts.delete(id);
  });
}

// Persist a new ordering (array of ids in display order).
export async function reorderTrackedLifts(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.trackedLifts, async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.trackedLifts.update(orderedIds[i], { order: i });
    }
  });
}

export interface OneRepMaxInput {
  liftId: string;
  liftName: string;
  date: string;
  weightKg: number;
  reps?: number; // default 1 (tested single); >1 stored as an estimate basis
  note?: string;
}

// Log a 1RM data point. reps > 1 marks the entry estimated; the comparable
// 1RM value is derived on read in lib/oneRepMax.ts (Epley), never stored.
export async function logOneRepMax(input: OneRepMaxInput): Promise<string> {
  const reps = input.reps && input.reps > 0 ? Math.round(input.reps) : 1;
  const id = newId();
  await db.oneRepMaxes.add({
    id,
    liftId: input.liftId,
    liftName: input.liftName,
    date: input.date,
    weightKg: input.weightKg,
    reps,
    estimated: reps > 1,
    note: input.note ?? '',
    createdAt: Date.now(),
  });
  return id;
}

export async function deleteOneRepMax(id: string): Promise<void> {
  await db.oneRepMaxes.delete(id);
}

// Re-insert a deleted entry verbatim (same id/createdAt) so an "Undo" toast can
// reverse an accidental delete. Mirrors restoreStrengthEntry / restoreWodResult.
export async function restoreOneRepMax(entry: OneRepMax): Promise<void> {
  await db.oneRepMaxes.put(entry);
}

// Edit an existing 1RM entry. Re-derives `estimated` from reps (mirrors logOneRepMax)
// so a corrected rep count flips the est. flag. The comparable 1RM is computed on read.
export async function updateOneRepMax(
  id: string,
  changes: { weightKg: number; reps: number; date: string; note?: string },
): Promise<void> {
  const reps = changes.reps > 0 ? Math.round(changes.reps) : 1;
  await db.oneRepMaxes.update(id, {
    weightKg: changes.weightKg,
    reps,
    estimated: reps > 1,
    date: changes.date,
    note: changes.note ?? '',
  });
}

// ===================================================================
// v3: runs
// ===================================================================

export interface RunInput {
  date: string;
  distanceKm: number;
  durationSec: number;
  rpe: number;
  runType?: string;
  notes?: string;
}

export async function addRun(input: RunInput): Promise<string> {
  const id = newId();
  const now = Date.now();
  await db.runs.add({
    id,
    date: input.date,
    distanceKm: input.distanceKm,
    durationSec: input.durationSec,
    rpe: input.rpe,
    runType: input.runType ?? '',
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateRun(
  id: string,
  patch: Partial<Omit<RunEntry, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.runs.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteRun(id: string): Promise<void> {
  await db.runs.delete(id);
}
