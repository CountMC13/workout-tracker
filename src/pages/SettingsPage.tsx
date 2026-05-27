import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, Database, Video, Save, Dumbbell } from 'lucide-react';
import {
  db,
  updateProfile,
  seedMovements,
  seedWods,
  createExercise,
  saveVideo,
} from '../db';
import { exportBackup, readBackup, snapshotCurrentData, applyBackup } from '../lib/backup';
import { getStorageStatus, formatBytes, type StorageStatus } from '../lib/storageStatus';
import { useToast } from '../hooks/useToast';
import type { Sex } from '../types';

// "1 - Foam Roller Shoulder mobility.mp4" -> "Foam Roller Shoulder mobility"
function exerciseNameFromFilename(filename: string): string {
  let n = filename.replace(/\.[^.]+$/, '');
  n = n.replace(/_/g, ' ');
  n = n.replace(/^\s*\d+\s*-\s*/, '');
  n = n.trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
}

export default function SettingsPage() {
  const { show, node } = useToast();
  const profile = useLiveQuery(() => db.profile.get('me'), []);

  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState('');
  const [sex, setSex] = useState<Sex>('unspecified');
  const [birthYear, setBirthYear] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState('');
  const [barWeight, setBarWeight] = useState('');
  const [loaded, setLoaded] = useState(false);

  const backupInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const [storage, setStorage] = useState<StorageStatus | null>(null);
  useEffect(() => {
    getStorageStatus().then(setStorage);
  }, []);

  const lastBackupAt = profile?.lastBackupAt ?? null;
  const daysSinceBackup = lastBackupAt == null ? null : Math.floor((Date.now() - lastBackupAt) / 86_400_000);
  const backupOverdue = daysSinceBackup == null || daysSinceBackup > 7;

  useEffect(() => {
    if (profile && !loaded) {
      setHeight(profile.heightCm != null ? String(profile.heightCm) : '');
      setGoal(profile.goalWeightKg != null ? String(profile.goalWeightKg) : '');
      setSex(profile.sex);
      setBirthYear(profile.birthYear != null ? String(profile.birthYear) : '');
      setWeeklyGoal(profile.weeklyRunGoalKm != null ? String(profile.weeklyRunGoalKm) : '');
      setBarWeight(profile.barWeightKg != null ? String(profile.barWeightKg) : '20');
      setLoaded(true);
    }
  }, [profile, loaded]);

  const saveProfile = async () => {
    await updateProfile({
      heightCm: height.trim() === '' ? null : Number(height),
      goalWeightKg: goal.trim() === '' ? null : Number(goal),
      sex,
      birthYear: birthYear.trim() === '' ? null : Number(birthYear),
      weeklyRunGoalKm: weeklyGoal.trim() === '' ? null : Math.max(0, Number(weeklyGoal)),
      barWeightKg: barWeight.trim() === '' ? 20 : Math.max(0, Number(barWeight)),
    });
    show('Profile saved');
  };

  const onExport = async () => {
    try {
      const saved = await exportBackup();
      if (saved) {
        await updateProfile({ lastBackupAt: Date.now() });
        show('Backup saved');
      }
    } catch {
      alert('Export failed.');
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    // 1. Parse + validate WITHOUT touching the database.
    let parsed;
    try {
      parsed = await readBackup(file);
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
      return;
    }
    const { data, videos, validation } = parsed;
    if (!validation.ok) {
      alert(`This file can't be restored:\n\n${validation.errors.join('\n')}`);
      return;
    }
    // 2. Confirm the destructive replace; warnings (if any) are shown inline.
    const warn = validation.warnings.length ? `\n\nNote:\n• ${validation.warnings.join('\n• ')}` : '';
    const ok = confirm(
      'Restore will REPLACE all current data on this device with the backup.\n\n' +
        'A safety copy of your CURRENT data will be downloaded first ' +
        '(fitness-backup-PRE-RESTORE-…zip) so you can undo this.' +
        warn +
        '\n\nContinue?',
    );
    if (!ok) return;
    // 3. Snapshot current data, then apply (a failure rolls the transaction back).
    try {
      await snapshotCurrentData();
      await applyBackup(data, videos);
      show('Data restored');
    } catch (e) {
      alert(
        `Restore failed: ${(e as Error).message}\n\n` +
          'Your data was not changed. If anything looks wrong, re-import the ' +
          'PRE-RESTORE snapshot that was just downloaded.',
      );
    }
  };

  const onSeed = async () => {
    const m = await seedMovements();
    const w = await seedWods();
    show(m + w > 0 ? `Loaded ${w} WODs, ${m} movements` : 'Library already loaded');
  };

  const onPickVideos = async (files: FileList | null) => {
    if (!files || !files.length) return;
    let added = 0;
    for (const file of Array.from(files)) {
      const videoId = await saveVideo(file);
      await createExercise({
        name: exerciseNameFromFilename(file.name),
        sets: null,
        reps: '',
        frequency: '',
        keyPoints: '',
        notes: '',
        muscleGroups: [],
        videoId,
      });
      added++;
    }
    show(`Imported ${added} exercise${added === 1 ? '' : 's'}`);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Settings</h1>
      </header>

      {/* Profile */}
      <h2 className="section-title">Profile</h2>
      <div className="card stack">
        <div className="field-row">
          <label className="field">
            <span>Height (cm)</span>
            <input type="number" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="180" />
          </label>
          <label className="field">
            <span>Goal weight (kg)</span>
            <input type="number" inputMode="decimal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="80" />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Sex</span>
            <select value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
              <option value="unspecified">Prefer not to say</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="field">
            <span>Birth year</span>
            <input type="number" inputMode="numeric" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="1990" />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Weekly run goal (km)</span>
            <input type="number" inputMode="decimal" value={weeklyGoal} onChange={(e) => setWeeklyGoal(e.target.value)} placeholder="20" />
          </label>
          <label className="field">
            <span>Barbell weight (kg)</span>
            <input type="number" inputMode="decimal" value={barWeight} onChange={(e) => setBarWeight(e.target.value)} placeholder="20" />
          </label>
        </div>
        <button className="btn-primary full" onClick={saveProfile}>
          <Save size={18} /> Save profile
        </button>
        <p className="settings-note">Weights are stored in kilograms. BMI is computed from your height.</p>
      </div>

      {/* Data */}
      <h2 className="section-title">Data &amp; backup</h2>
      <div className="card stack">
        <p className="settings-note">
          All your data lives only on this device. Export a backup regularly — clearing browser/app storage erases everything.
        </p>

        <p className="settings-note">
          <strong>Storage:</strong>{' '}
          {storage
            ? `${formatBytes(storage.usageBytes)} used${storage.quotaBytes ? ` of ${formatBytes(storage.quotaBytes)}` : ''}`
            : '…'}
          <br />
          {storage?.persisted
            ? '✅ Protected from automatic cleanup.'
            : '⚠️ Not protected — the browser may clear this data under storage pressure. Back up regularly.'}
        </p>

        <p className="settings-note">
          <strong>Last backup:</strong>{' '}
          {daysSinceBackup == null
            ? 'never'
            : daysSinceBackup === 0
              ? 'today'
              : `${daysSinceBackup} day${daysSinceBackup === 1 ? '' : 's'} ago`}
        </p>
        {backupOverdue && (
          <p className="settings-note" style={{ color: 'var(--danger)', fontWeight: 600 }}>
            💾 It's been a while since your last backup — export now to keep your data safe.
          </p>
        )}

        <button className="btn-primary full" onClick={onExport}>
          <Download size={18} /> Export all data (.zip)
        </button>
        <input
          ref={backupInput}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(e) => onImport(e.target.files?.[0])}
        />
        <button className="btn-secondary full" onClick={() => backupInput.current?.click()}>
          <Upload size={18} /> Restore from backup
        </button>
      </div>

      {/* Starter content */}
      <h2 className="section-title">Starter content</h2>
      <div className="card stack">
        <button className="btn-secondary full" onClick={onSeed}>
          <Database size={18} /> Load WOD &amp; movement library
        </button>
        <input
          ref={videoInput}
          type="file"
          accept="video/mp4,video/*"
          multiple
          hidden
          onChange={(e) => onPickVideos(e.target.files)}
        />
        <button className="btn-secondary full" onClick={() => videoInput.current?.click()}>
          <Video size={18} /> Import physio videos as exercises
        </button>
        <p className="settings-note">
          <Dumbbell size={13} style={{ verticalAlign: 'middle' }} /> Pick the MP4 files from your Videos folder — one
          exercise is created per file (edit details &amp; tags afterwards).
        </p>
      </div>

      {node}
    </div>
  );
}
