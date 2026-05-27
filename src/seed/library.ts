// One-time seed data for the workout libraries. Inserted only when the
// corresponding table is empty (see seedMovements / seedWods in db.ts).
import type { Movement, Wod } from '../types';

type MovementSeed = Omit<Movement, 'id' | 'createdAt'>;
type WodSeed = Omit<Wod, 'id' | 'createdAt'>;

export const MOVEMENTS_SEED: MovementSeed[] = [
  // Olympic
  { name: 'Snatch', category: 'Olympic' },
  { name: 'Snatch Balance', category: 'Olympic' },
  { name: 'Power Snatch', category: 'Olympic' },
  { name: 'Clean', category: 'Olympic' },
  { name: 'Power Clean', category: 'Olympic' },
  { name: 'Clean & Jerk', category: 'Olympic' },
  { name: 'Push Jerk', category: 'Olympic' },
  // Squat
  { name: 'Back Squat', category: 'Squat' },
  { name: 'Front Squat', category: 'Squat' },
  { name: 'Overhead Squat', category: 'Squat' },
  // Press
  { name: 'Strict Press', category: 'Press' },
  { name: 'Push Press', category: 'Press' },
  { name: 'Bench Press', category: 'Press' },
  { name: 'Thruster', category: 'Press' },
  // Pull / Deadlift
  { name: 'Deadlift', category: 'Deadlift' },
  { name: 'Sumo Deadlift', category: 'Deadlift' },
  { name: 'Bent-over Row', category: 'Pull' },
  // Gymnastics
  { name: 'Pull-up', category: 'Gymnastics' },
  { name: 'Chest-to-bar Pull-up', category: 'Gymnastics' },
  { name: 'Toes-to-bar', category: 'Gymnastics' },
  { name: 'Handstand Push-up', category: 'Gymnastics' },
  { name: 'Muscle-up', category: 'Gymnastics' },
  { name: 'Push-up', category: 'Gymnastics' },
  { name: 'Air Squat', category: 'Gymnastics' },
  // Conditioning
  { name: 'Wall Ball', category: 'Conditioning' },
  { name: 'Box Jump', category: 'Conditioning' },
  { name: 'Burpee', category: 'Conditioning' },
  { name: 'Double-under', category: 'Conditioning' },
  { name: 'Row (Calories)', category: 'Conditioning' },
  { name: 'Run', category: 'Conditioning' },
  { name: 'Kettlebell Swing', category: 'Conditioning' },
];

export const WODS_SEED: WodSeed[] = [
  // The five from your spreadsheet first
  {
    name: 'Fran',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Thrusters & Pull-ups',
    targetText: 'Under 5 mins',
    description: '21-15-9 reps for time:\nThrusters (43/30 kg)\nPull-ups',
  },
  {
    name: 'Cindy',
    classification: 'benchmark',
    scoreType: 'amrap',
    keyComponent: 'Bodyweight / Gymnastics',
    targetText: '15–25 rounds',
    description: 'AMRAP in 20 min:\n5 Pull-ups\n10 Push-ups\n15 Air Squats',
  },
  {
    name: 'Grace',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Barbell Cycling',
    targetText: 'Under 4 mins',
    description: '30 Clean & Jerks for time (61/43 kg)',
  },
  {
    name: 'Murph',
    classification: 'hero',
    scoreType: 'forTime',
    keyComponent: 'Extreme Volume / Chipper',
    targetText: '40–60 mins',
    description: 'For time (wear a 9/6 kg vest):\n1 mile Run\n100 Pull-ups\n200 Push-ups\n300 Air Squats\n1 mile Run',
  },
  {
    name: 'DT',
    classification: 'hero',
    scoreType: 'forTime',
    keyComponent: 'Heavy Barbell',
    targetText: 'Under 8 mins',
    description: '5 rounds for time (70/47 kg):\n12 Deadlifts\n9 Hang Power Cleans\n6 Push Jerks',
  },
  // A few more common benchmarks so the catalog feels real
  {
    name: 'Helen',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Running / Kettlebell',
    targetText: 'Under 12 mins',
    description: '3 rounds for time:\n400 m Run\n21 Kettlebell Swings (24/16 kg)\n12 Pull-ups',
  },
  {
    name: 'Diane',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Deadlift & HSPU',
    targetText: 'Under 5 mins',
    description: '21-15-9 reps for time:\nDeadlifts (102/70 kg)\nHandstand Push-ups',
  },
  {
    name: 'Karen',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Wall Balls',
    targetText: 'Under 8 mins',
    description: '150 Wall Ball shots for time (9/6 kg)',
  },
  {
    name: 'Annie',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Double-unders & Sit-ups',
    targetText: 'Under 8 mins',
    description: '50-40-30-20-10 reps for time:\nDouble-unders\nSit-ups',
  },
  {
    name: 'Angie',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Bodyweight Chipper',
    targetText: 'Under 20 mins',
    description: 'For time:\n100 Pull-ups\n100 Push-ups\n100 Sit-ups\n100 Air Squats',
  },
  {
    name: 'Jackie',
    classification: 'benchmark',
    scoreType: 'forTime',
    keyComponent: 'Row / Thrusters / Pull-ups',
    targetText: 'Under 11 mins',
    description: 'For time:\n1000 m Row\n50 Thrusters (20/15 kg)\n30 Pull-ups',
  },
  {
    name: 'Chelsea',
    classification: 'benchmark',
    scoreType: 'amrap',
    keyComponent: 'EMOM Gymnastics',
    targetText: '30 rounds',
    description: 'EMOM for 30 min:\n5 Pull-ups\n10 Push-ups\n15 Air Squats',
  },
];
