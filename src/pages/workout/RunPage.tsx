import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, ChevronRight, Footprints } from 'lucide-react';
import { db, getProfile, addRun } from '../../db';
import { todayKey, formatShort } from '../../lib/dates';
import {
  KM_PER_MILE,
  paceSecPerKm,
  formatPace,
  formatDistance,
  formatRunDuration,
  runningBests,
  currentWeekDistanceKm,
} from '../../lib/runs';
import { RUN_TYPES, RPE_SCALE } from '../../constants';
import type { UnitSystem } from '../../types';
import { useToast } from '../../hooks/useToast';

// Shared input state for logging / editing a run. Distance is kept in the user's
// display unit (km or mi) while typing; convert to km only on save.
export interface RunFormValues {
  date: string;
  distance: string; // in display unit
  hours: string;
  minutes: string;
  seconds: string;
  rpe: number;
  runType: string;
  notes: string;
}

export function emptyRunForm(): RunFormValues {
  return { date: todayKey(), distance: '', hours: '', minutes: '', seconds: '', rpe: 5, runType: '', notes: '' };
}

export function formToDurationSec(v: RunFormValues): number {
  const h = Number(v.hours) || 0;
  const m = Number(v.minutes) || 0;
  const s = Number(v.seconds) || 0;
  return h * 3600 + m * 60 + s;
}

// Distance entered in the user's unit -> km for storage.
export function formToDistanceKm(v: RunFormValues, units: UnitSystem): number {
  const d = Number(v.distance) || 0;
  return units === 'imperial' ? d * KM_PER_MILE : d;
}

export function isRunFormValid(v: RunFormValues, units: UnitSystem): boolean {
  return formToDistanceKm(v, units) > 0 && formToDurationSec(v) > 0;
}

// A run with no real distance/duration shouldn't compute a pace preview.
function previewPace(v: RunFormValues, units: UnitSystem): string | null {
  const km = formToDistanceKm(v, units);
  const sec = formToDurationSec(v);
  if (km <= 0 || sec <= 0) return null;
  return formatPace(sec / km, units);
}

// Reusable run form, shared with RunDetailPage (edit mode). Controlled via value/onChange.
export function RunForm({
  value,
  onChange,
  units,
  onSave,
  onCancel,
  saveLabel = 'Save',
}: {
  value: RunFormValues;
  onChange: (v: RunFormValues) => void;
  units: UnitSystem;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}) {
  const set = <K extends keyof RunFormValues>(key: K, v: RunFormValues[K]) =>
    onChange({ ...value, [key]: v });

  const unitLabel = units === 'imperial' ? 'mi' : 'km';
  const pace = previewPace(value, units);
  const valid = isRunFormValid(value, units);
  const rpeLabel = RPE_SCALE.find((r) => r.value === value.rpe)?.label ?? '';

  return (
    <div className="form">
      <label className="field">
        <span>Date</span>
        <input type="date" value={value.date} max={todayKey()} onChange={(e) => set('date', e.target.value)} />
      </label>

      <label className="field">
        <span>Distance ({unitLabel})</span>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder={units === 'imperial' ? 'e.g. 3.1' : 'e.g. 5.0'}
          value={value.distance}
          onChange={(e) => set('distance', e.target.value)}
          aria-label={`Distance in ${unitLabel}`}
        />
      </label>

      <div className="field">
        <span>Duration</span>
        <div className="field-row">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="h"
            value={value.hours}
            onChange={(e) => set('hours', e.target.value)}
            aria-label="Hours"
          />
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="min"
            value={value.minutes}
            onChange={(e) => set('minutes', e.target.value)}
            aria-label="Minutes"
          />
          <input
            type="number"
            inputMode="numeric"
            min="0"
            placeholder="sec"
            value={value.seconds}
            onChange={(e) => set('seconds', e.target.value)}
            aria-label="Seconds"
          />
        </div>
      </div>

      <div className="field">
        <span>Effort (RPE {value.rpe} · {rpeLabel})</span>
        <div className="filter-row">
          {RPE_SCALE.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`filter-chip ${value.rpe === r.value ? 'active' : ''}`}
              onClick={() => set('rpe', r.value)}
              aria-pressed={value.rpe === r.value}
            >
              {r.value}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Run type</span>
        <div className="filter-row">
          <button
            type="button"
            className={`filter-chip ${value.runType === '' ? 'active' : ''}`}
            onClick={() => set('runType', '')}
            aria-pressed={value.runType === ''}
          >
            None
          </button>
          {RUN_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`filter-chip ${value.runType === t ? 'active' : ''}`}
              onClick={() => set('runType', t)}
              aria-pressed={value.runType === t}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Notes</span>
        <textarea
          rows={2}
          placeholder="Optional"
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>

      <p className="muted center" style={{ margin: 0 }}>
        {pace ? `Pace ${pace}` : 'Enter distance and duration to see pace'}
      </p>

      <div className="form-actions">
        <button className="btn-primary full tap" disabled={!valid} onClick={onSave}>
          {saveLabel}
        </button>
        <button className="btn-secondary full" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function RunPage() {
  const profile = useLiveQuery(() => getProfile(), []);
  const weekKm = useLiveQuery(() => currentWeekDistanceKm(), []);
  const bests = useLiveQuery(() => runningBests(), []);
  const recent = useLiveQuery(() => db.runs.orderBy('date').reverse().limit(20).toArray(), []);
  const { show, node } = useToast();

  const [logging, setLogging] = useState(false);
  const [form, setForm] = useState<RunFormValues>(emptyRunForm());

  const units: UnitSystem = profile?.units ?? 'metric';
  const goalKm = profile?.weeklyRunGoalKm ?? null;
  const week = weekKm ?? 0;
  const pct = goalKm && goalKm > 0 ? Math.min(100, Math.round((week / goalKm) * 100)) : null;

  const benchmarkNote = useMemo(
    () => 'A benchmark is your fastest whole run of about that distance — not a split inside a longer run.',
    [],
  );

  const openLog = () => {
    setForm(emptyRunForm());
    setLogging(true);
  };

  const save = async () => {
    if (!isRunFormValid(form, units)) return;
    await addRun({
      date: form.date,
      distanceKm: formToDistanceKm(form, units),
      durationSec: formToDurationSec(form),
      rpe: form.rpe,
      runType: form.runType || undefined,
      notes: form.notes || undefined,
    });
    setLogging(false);
    setForm(emptyRunForm());
    show('Run logged');
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Running</h1>
      </header>

      {/* This week */}
      <div className="card stack">
        <div className="row-between">
          <span className="section-title" style={{ margin: 0 }}>This week</span>
          <strong>
            {formatDistance(week, units)}
            {goalKm && goalKm > 0 ? ` / ${formatDistance(goalKm, units)}` : ''}
          </strong>
        </div>
        {pct != null ? (
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Set a weekly run goal in Settings to track progress.
          </p>
        )}
      </div>

      {/* Log run */}
      {logging ? (
        <div className="card" style={{ marginTop: 12 }}>
          <RunForm
            value={form}
            onChange={setForm}
            units={units}
            onSave={save}
            onCancel={() => setLogging(false)}
            saveLabel="Save run"
          />
        </div>
      ) : (
        <button className="btn-primary full tap" style={{ marginTop: 12 }} onClick={openLog}>
          <Plus size={18} /> Log run
        </button>
      )}

      {/* Personal bests */}
      <h2 className="section-title">Personal bests</h2>
      {!bests || (!bests.longest && !bests.bestPace && bests.benchmarks.length === 0) ? (
        <div className="empty-state">
          <Footprints size={40} />
          <h2>No runs yet</h2>
          <p>Log a run to start tracking your bests.</p>
        </div>
      ) : (
        <>
          {bests.longest && (
            <div className="pr-row">
              <div className="pr-name">
                Longest run
                <div className="pr-sub">{formatShort(bests.longest.run.date)}</div>
              </div>
              <div className="pr-value">{formatDistance(bests.longest.km, units)}</div>
            </div>
          )}
          {bests.bestPace && (
            <div className="pr-row">
              <div className="pr-name">
                Best pace
                <div className="pr-sub">{formatShort(bests.bestPace.run.date)}</div>
              </div>
              <div className="pr-value">{formatPace(bests.bestPace.secPerKm, units)}</div>
            </div>
          )}
          {bests.benchmarks.map((b) => (
            <div key={b.label} className="pr-row">
              <div className="pr-name">
                {b.label}
                <div className="pr-sub">{formatShort(b.run.date)}</div>
              </div>
              <div className="pr-value">{formatRunDuration(b.durationSec)}</div>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>{benchmarkNote}</p>
        </>
      )}

      {/* Recent runs */}
      <h2 className="section-title">Recent runs</h2>
      {!recent || recent.length === 0 ? (
        <p className="muted">No runs logged yet.</p>
      ) : (
        <ul className="day-list">
          {recent.map((run) => {
            const p = paceSecPerKm(run);
            return (
              <li key={run.id} className="day-item">
                <Link
                  to={`/run/${run.id}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, color: 'inherit', textDecoration: 'none' }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="day-item-name">
                      {formatShort(run.date)} · {formatDistance(run.distanceKm, units)}
                    </div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {formatRunDuration(run.durationSec)}
                      {p != null ? ` · ${formatPace(p, units)}` : ''}
                      {` · RPE ${run.rpe}`}
                      {run.runType ? ` · ${run.runType}` : ''}
                    </div>
                  </div>
                  <ChevronRight size={18} className="muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {node}
    </div>
  );
}
