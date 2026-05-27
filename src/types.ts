export interface Exercise {
  id: string;
  name: string;
  sets: number | null;
  reps: string; // string so "30s hold", "10 each side" etc. are allowed
  frequency: string;
  keyPoints: string;
  notes: string;
  muscleGroups: string[];
  videoId: string | null;
  order: number;
  createdAt: number;
}

export interface VideoFile {
  id: string;
  name: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

export interface Completion {
  id: string;
  exerciseId: string;
  date: string; // local calendar date, YYYY-MM-DD
  createdAt: number;
}

// ===================================================================
// Body metrics
// ===================================================================

export type UnitSystem = 'metric' | 'imperial';
export type Sex = 'male' | 'female' | 'unspecified';

// Singleton row, fixed id 'me'. Height/units/goal live here so a height
// correction instantly re-computes every historical BMI.
export interface Profile {
  id: 'me';
  heightCm: number | null;
  units: UnitSystem; // display preference; storage is always metric
  sex: Sex;
  birthYear: number | null;
  goalWeightKg: number | null;
  restSec: number; // default rest-timer length, seconds
  lastBackupAt: number | null; // epoch ms of last successful export (drives the backup reminder)
  weeklyRunGoalKm: number | null; // optional weekly running distance target
  barWeightKg: number | null; // barbell weight for the plate-loading helper (default 20)
  updatedAt: number;
}

export interface WeightEntry {
  id: string;
  date: string; // YYYY-MM-DD, one entry per day (re-logging replaces it)
  weightKg: number; // always stored in kg
  note: string;
  createdAt: number;
  updatedAt: number;
}

// ===================================================================
// Workout: reference libraries
// ===================================================================

// Reusable movement (Snatch, Thruster, Pull-up...). Picked when logging strength.
export interface Movement {
  id: string;
  name: string;
  category: string; // Olympic | Squat | Press | Pull | Deadlift | Gymnastics | Conditioning | Other
  createdAt: number;
}

export type WodScoreType = 'forTime' | 'amrap' | 'load' | 'reps';
export type WodClass = 'benchmark' | 'hero' | 'open' | 'custom';

// A named workout definition (Fran, Cindy...) you log results against repeatedly.
export interface Wod {
  id: string;
  name: string;
  classification: WodClass;
  scoreType: WodScoreType;
  keyComponent: string;
  targetText: string; // Rx reference, e.g. "Under 5 mins"
  description: string;
  createdAt: number;
}

// ===================================================================
// Workout: logged training
// ===================================================================

export type Felt = 'easy' | 'ok' | 'hard' | 'failed';
export type RxStatus = 'rx' | 'scaled';

// A training day. Holds strength entries and/or WOD results (linked by sessionId).
export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD
  type: string; // e.g. "Weightlifting", "Metcon"
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface StrengthSet {
  reps: number;
  weightKg: number | null; // null = bodyweight movement
  done: boolean;
}

// One movement performed in a session (mirrors a spreadsheet row).
export interface StrengthEntry {
  id: string;
  sessionId: string;
  movementId: string;
  movementName: string; // denormalized so history reads even if library changes
  order: number;
  sets: StrengthSet[];
  felt: Felt | null;
  notes: string;
}

// A result logged against a Wod.
export interface WodResult {
  id: string;
  sessionId: string;
  wodId: string;
  wodName: string; // denormalized
  date: string;
  scoreType: WodScoreType;
  rxStatus: RxStatus;
  durationSec: number | null; // forTime
  rounds: number | null; // amrap
  extraReps: number | null; // amrap partial round
  score: number | null; // load (kg) or reps, depending on scoreType
  cappedOut: boolean;
  notes: string;
  createdAt: number;
}

// ===================================================================
// v3: 1-rep-max tracking + running
// ===================================================================

// A lift the user tracks a 1RM for (seeded with 6 defaults, max 10).
// movementId optionally links to the strength movements library, but the
// 1RM board does not depend on it — liftName is the source of truth here.
export interface TrackedLift {
  id: string;
  name: string;
  order: number;
  movementId: string | null;
  createdAt: number;
}

// One manually-logged 1RM data point for a tracked lift. When reps > 1 the entry
// is an estimate: value1RM is derived with Epley (see lib/oneRepMax.ts), and
// `estimated` is true so the UI can flag it.
export interface OneRepMax {
  id: string;
  liftId: string;
  liftName: string; // denormalized so history reads even if the lift is renamed/removed
  date: string; // YYYY-MM-DD
  weightKg: number; // the weight lifted (always stored in kg)
  reps: number; // 1 = tested single; >1 = basis for an estimate
  estimated: boolean; // true when reps > 1
  note: string;
  createdAt: number;
}

// A logged run. Distance stored in km; pace is derived (durationSec / distanceKm).
export interface RunEntry {
  id: string;
  date: string; // YYYY-MM-DD
  distanceKm: number; // always stored in km
  durationSec: number; // total elapsed seconds
  rpe: number; // perceived effort, 1–10
  runType: string; // e.g. "Easy", "Tempo", "Long" (see RUN_TYPES); free text allowed
  notes: string;
  createdAt: number;
  updatedAt: number;
}
