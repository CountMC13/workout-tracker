// One self-contained .zip backup: data.json (all records + video metadata) plus
// videos/<id>.mp4 stored uncompressed (MP4 is already compressed). Restore is a
// full Replace inside a single transaction — simplest bulletproof model.
import JSZip from 'jszip';
import { db } from '../db';
import type {
  Exercise,
  Completion,
  Profile,
  WeightEntry,
  Movement,
  Wod,
  WorkoutSession,
  StrengthEntry,
  WodResult,
  VideoFile,
  TrackedLift,
  OneRepMax,
  RunEntry,
} from '../types';

const SCHEMA_VERSION = 3;

// Tables expected as arrays in data.json (profile is the singleton row in an array).
const EXPECTED_TABLES = [
  'exercises',
  'completions',
  'profile',
  'weights',
  'movements',
  'wods',
  'sessions',
  'strengthEntries',
  'wodResults',
  'trackedLifts',
  'oneRepMaxes',
  'runs',
] as const;

export interface BackupData {
  schemaVersion?: number;
  exportedAt?: string;
  [table: string]: unknown;
}

export interface BackupValidation {
  ok: boolean;
  errors: string[]; // block the restore
  warnings: string[]; // allow restore after a confirm
  schemaVersion: number | null;
}

export interface ParsedBackup {
  data: BackupData;
  videos: VideoFile[];
  validation: BackupValidation;
}

export async function buildBackupZip(): Promise<Blob> {
  const [
    exercises,
    completions,
    videos,
    profile,
    weights,
    movements,
    wods,
    sessions,
    strengthEntries,
    wodResults,
    trackedLifts,
    oneRepMaxes,
    runs,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.completions.toArray(),
    db.videos.toArray(),
    db.profile.toArray(),
    db.weights.toArray(),
    db.movements.toArray(),
    db.wods.toArray(),
    db.sessions.toArray(),
    db.strengthEntries.toArray(),
    db.wodResults.toArray(),
    db.trackedLifts.toArray(),
    db.oneRepMaxes.toArray(),
    db.runs.toArray(),
  ]);

  const data = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    completions,
    profile,
    weights,
    movements,
    wods,
    sessions,
    strengthEntries,
    wodResults,
    trackedLifts,
    oneRepMaxes,
    runs,
    videos: videos.map((v) => ({ id: v.id, name: v.name, mimeType: v.mimeType, createdAt: v.createdAt })),
  };

  const zip = new JSZip();
  zip.file('data.json', JSON.stringify(data));
  const folder = zip.folder('videos')!;
  for (const v of videos) {
    folder.file(`${v.id}.mp4`, v.blob, { compression: 'STORE' });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// True when the browser can share an actual file via the OS share sheet. This is
// the only reliable "save a file" path on Android Chrome / iOS Safari, where
// showSaveFilePicker doesn't exist and <a download> is ignored by iOS.
function canShareFile(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (data: { files?: File[] }) => boolean };
  return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });
}

// Returns true if the backup was actually written, false if the user cancelled
// the Save/Share dialog (so the caller doesn't wrongly record a "last backup" time).
export async function exportBackup(): Promise<boolean> {
  const blob = await buildBackupZip();
  const filename = `fitness-backup-${new Date().toISOString().slice(0, 10)}.zip`;

  // Prefer a real "Save As" dialog where supported (desktop Edge/Chrome).
  const picker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<unknown> }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = (await picker({
        suggestedName: filename,
        types: [{ description: 'Backup', accept: { 'application/zip': ['.zip'] } }],
      })) as { createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> };
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return false; // user cancelled
      // otherwise fall through to share/download
    }
  }

  // On mobile, hand the file to the OS share sheet so it can be saved to Files,
  // Drive, etc. This is the path that actually works on Android/iOS.
  const file = new File([blob], filename, { type: 'application/zip' });
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: 'Fitness backup' });
      return true;
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') return false; // user dismissed the share sheet
      // otherwise fall through to a plain download
    }
  }

  downloadBlob(blob, filename);
  return true;
}

// Structural check that runs BEFORE any database change. Errors block the
// restore; warnings (version mismatch, missing videos) only need a confirm.
export function validateBackupData(data: unknown): BackupValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (typeof data !== 'object' || data === null) {
    return { ok: false, errors: ['Backup file is not valid data.'], warnings, schemaVersion: null };
  }
  const d = data as Record<string, unknown>;
  const schemaVersion = typeof d.schemaVersion === 'number' ? d.schemaVersion : null;

  for (const t of EXPECTED_TABLES) {
    if (t in d && !Array.isArray(d[t])) errors.push(`"${t}" is not a list — file looks corrupt.`);
  }
  if (!EXPECTED_TABLES.some((t) => Array.isArray(d[t]))) {
    errors.push('No recognised data tables found — this may not be a fitness backup.');
  }

  if (schemaVersion === null) {
    warnings.push('No version found in the backup; restoring may be unreliable.');
  } else if (schemaVersion < SCHEMA_VERSION) {
    warnings.push(`Backup is from an older version (v${schemaVersion}); newer sections may be empty.`);
  } else if (schemaVersion > SCHEMA_VERSION) {
    warnings.push(`Backup is from a newer version (v${schemaVersion}); some data may not import correctly.`);
  }
  return { ok: errors.length === 0, errors, warnings, schemaVersion };
}

// Parse + validate the file and rebuild video blobs WITHOUT touching the database.
// Throws only when the file is fundamentally unreadable; structural problems are
// reported in `validation` so the caller can decide.
export async function readBackup(file: File): Promise<ParsedBackup> {
  const zip = await JSZip.loadAsync(file);
  const dataFile = zip.file('data.json');
  if (!dataFile) throw new Error('Not a valid backup file (missing data.json).');
  let data: BackupData;
  try {
    data = JSON.parse(await dataFile.async('string')) as BackupData;
  } catch {
    throw new Error('Backup is corrupt (data.json could not be parsed).');
  }
  const validation = validateBackupData(data);

  const videoMeta = Array.isArray(data.videos) ? (data.videos as Array<Record<string, string>>) : [];
  const videos: VideoFile[] = [];
  let missing = 0;
  for (const meta of videoMeta) {
    const entry = zip.file(`videos/${meta.id}.mp4`);
    if (!entry) {
      missing++;
      continue;
    }
    const buf = await entry.async('arraybuffer');
    videos.push({
      id: meta.id,
      name: meta.name,
      mimeType: meta.mimeType,
      createdAt: Number(meta.createdAt),
      blob: new Blob([buf], { type: meta.mimeType || 'video/mp4' }),
    });
  }
  if (missing > 0) validation.warnings.push(`${missing} video file(s) referenced but missing from the backup.`);
  return { data, videos, validation };
}

// Download a snapshot of the CURRENT data so a bad restore can be undone.
// Call this immediately before applyBackup().
export async function snapshotCurrentData(): Promise<void> {
  const blob = await buildBackupZip();
  downloadBlob(blob, `fitness-backup-PRE-RESTORE-${new Date().toISOString().slice(0, 10)}.zip`);
}

// Destructive: replace every table with the backup's contents. A throw inside
// the transaction aborts it and Dexie rolls back, so a mid-restore failure
// cannot leave the database half-wiped.
export async function applyBackup(data: BackupData, videos: VideoFile[]): Promise<void> {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  await db.transaction(
    'rw',
    [
      db.exercises,
      db.completions,
      db.videos,
      db.profile,
      db.weights,
      db.movements,
      db.wods,
      db.sessions,
      db.strengthEntries,
      db.wodResults,
      db.trackedLifts,
      db.oneRepMaxes,
      db.runs,
    ],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.completions.clear(),
        db.videos.clear(),
        db.profile.clear(),
        db.weights.clear(),
        db.movements.clear(),
        db.wods.clear(),
        db.sessions.clear(),
        db.strengthEntries.clear(),
        db.wodResults.clear(),
        db.trackedLifts.clear(),
        db.oneRepMaxes.clear(),
        db.runs.clear(),
      ]);
      await db.exercises.bulkAdd(arr<Exercise>(data.exercises));
      await db.completions.bulkAdd(arr<Completion>(data.completions));
      await db.videos.bulkAdd(videos);
      const profile = arr<Profile>(data.profile);
      if (profile.length) await db.profile.bulkAdd(profile);
      await db.weights.bulkAdd(arr<WeightEntry>(data.weights));
      await db.movements.bulkAdd(arr<Movement>(data.movements));
      await db.wods.bulkAdd(arr<Wod>(data.wods));
      await db.sessions.bulkAdd(arr<WorkoutSession>(data.sessions));
      await db.strengthEntries.bulkAdd(arr<StrengthEntry>(data.strengthEntries));
      await db.wodResults.bulkAdd(arr<WodResult>(data.wodResults));
      await db.trackedLifts.bulkAdd(arr<TrackedLift>(data.trackedLifts));
      await db.oneRepMaxes.bulkAdd(arr<OneRepMax>(data.oneRepMaxes));
      await db.runs.bulkAdd(arr<RunEntry>(data.runs));
    },
  );
}
