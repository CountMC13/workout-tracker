import type { Felt, WodScoreType } from './types';

// Preset muscle-group tags from the PRD. Users can also add custom tags.
export const MUSCLE_GROUPS = [
  'Back',
  'Legs',
  'Arms',
  'Lats',
  'Hamstrings',
  'Glutes',
  'Core',
  'Shoulders',
] as const;

export const FREQUENCY_PRESETS = [
  'Daily',
  'Twice daily',
  'Every other day',
  '3x per week',
  '2x per week',
  'Weekly',
  'As needed',
] as const;

// Stable color per tag so chips are recognisable across the app.
const TAG_COLORS = [
  '#0d9488', '#2563eb', '#7c3aed', '#db2777',
  '#ea580c', '#65a30d', '#0891b2', '#dc2626',
  '#4f46e5', '#c026d3', '#0284c7', '#16a34a',
];

export function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

// --- Workout presets ---

export const SESSION_TYPES = [
  'Weightlifting',
  'Strength',
  'Metcon',
  'Gymnastics',
  'Conditioning',
  'Open Gym',
  'Mixed',
] as const;

export const MOVEMENT_CATEGORIES = [
  'Olympic',
  'Squat',
  'Press',
  'Pull',
  'Deadlift',
  'Gymnastics',
  'Conditioning',
  'Other',
] as const;

export const FELT_OPTIONS: { value: Felt; label: string; emoji: string }[] = [
  { value: 'easy', label: 'Easy', emoji: '😌' },
  { value: 'ok', label: 'Ok', emoji: '🙂' },
  { value: 'hard', label: 'Hard', emoji: '😬' },
  { value: 'failed', label: 'Failed', emoji: '✗' },
];

export const SCORE_TYPE_LABELS: Record<WodScoreType, string> = {
  forTime: 'For Time',
  amrap: 'AMRAP',
  load: 'Max Load',
  reps: 'Max Reps',
};

// --- 1RM tracking ---

// Lifts seeded into the 1RM board on first load. Users can add/remove/reorder up
// to MAX_TRACKED_LIFTS. Kept here (not the movements library) so the 1RM board has
// a stable curated default independent of the WOD/strength movement catalogue.
export const DEFAULT_TRACKED_LIFTS = [
  'Front Squat',
  'Back Squat',
  'Bench Press',
  'Deadlift',
  'Snatch',
  'Strict Push Press',
] as const;

export const MAX_TRACKED_LIFTS = 10;

// Working-set percentages shown by the 1RM % calculator (heaviest first).
export const PERCENT_STEPS = [95, 90, 85, 80, 75, 70, 65, 60] as const;

// Plates available per side, heaviest first (kg). Used by the plate-loading helper.
export const PLATE_SET_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;

export const DEFAULT_BAR_KG = 20;

// --- Running ---

export const RUN_TYPES = [
  'Easy',
  'Recovery',
  'Tempo',
  'Long',
  'Intervals',
  'Race',
] as const;

// Rate of Perceived Exertion, 1 (easiest) – 10 (max effort), with short cues.
export const RPE_SCALE: { value: number; label: string }[] = [
  { value: 1, label: 'Very easy' },
  { value: 2, label: 'Easy' },
  { value: 3, label: 'Comfortable' },
  { value: 4, label: 'Moderate' },
  { value: 5, label: 'Somewhat hard' },
  { value: 6, label: 'Hard' },
  { value: 7, label: 'Vigorous' },
  { value: 8, label: 'Very hard' },
  { value: 9, label: 'Near max' },
  { value: 10, label: 'Max effort' },
];
