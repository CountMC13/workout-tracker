import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { db, getProfile, updateRun, deleteRun } from '../../db';
import { formatLong } from '../../lib/dates';
import { paceSecPerKm, formatPace, formatDistance, formatRunDuration, KM_PER_MILE } from '../../lib/runs';
import { RPE_SCALE } from '../../constants';
import type { RunEntry, UnitSystem } from '../../types';
import { useToast } from '../../hooks/useToast';
import {
  RunForm,
  emptyRunForm,
  formToDistanceKm,
  formToDurationSec,
  isRunFormValid,
  type RunFormValues,
} from './RunPage';

// Seconds split back into h/m/s strings for the edit form. Hours stays '' when zero
// so short runs don't show a leading "0".
function durationToForm(totalSec: number): Pick<RunFormValues, 'hours' | 'minutes' | 'seconds'> {
  const t = Math.round(totalSec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return { hours: h > 0 ? String(h) : '', minutes: String(m), seconds: String(s) };
}

function runToForm(run: RunEntry, units: UnitSystem): RunFormValues {
  const distance = units === 'imperial' ? run.distanceKm / KM_PER_MILE : run.distanceKm;
  return {
    date: run.date,
    distance: units === 'imperial' ? distance.toFixed(2) : distance.toFixed(1),
    rpe: run.rpe,
    runType: run.runType ?? '',
    notes: run.notes ?? '',
    ...durationToForm(run.durationSec),
  };
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const profile = useLiveQuery(() => getProfile(), []);
  // useLiveQuery yields `undefined` while the query is in-flight; map a missing row
  // to `null` so we can show a spinner-free blank while loading and only render the
  // "not found" state once the query has actually settled.
  const run = useLiveQuery(async () => (id ? (await db.runs.get(id)) ?? null : null), [id]);
  const { show, node } = useToast();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<RunFormValues>(emptyRunForm());

  const units: UnitSystem = profile?.units ?? 'metric';

  if (run === undefined) return <div className="page" />; // loading

  if (run === null) {
    return (
      <div className="page">
        <header className="page-header">
          <Link to="/run" className="icon-btn" aria-label="Back to running">
            <ArrowLeft size={20} />
          </Link>
          <h1>Run</h1>
        </header>
        <p className="muted center" style={{ padding: '24px 0' }}>Run not found.</p>
        <Link to="/run" className="btn-secondary full">Back to running</Link>
      </div>
    );
  }

  const startEdit = () => {
    setForm(runToForm(run, units));
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!id || !isRunFormValid(form, units)) return;
    await updateRun(id, {
      date: form.date,
      distanceKm: formToDistanceKm(form, units),
      durationSec: formToDurationSec(form),
      rpe: form.rpe,
      runType: form.runType,
      notes: form.notes,
    });
    setEditing(false);
    show('Run updated');
  };

  const remove = async () => {
    if (!id) return;
    if (!window.confirm('Delete this run? This cannot be undone.')) return;
    await deleteRun(id);
    navigate('/run');
  };

  const pace = paceSecPerKm(run);
  const rpeLabel = RPE_SCALE.find((r) => r.value === run.rpe)?.label ?? '';

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/run" className="icon-btn" aria-label="Back to running">
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ flex: 1 }}>{run.runType || 'Run'}</h1>
        {!editing && (
          <button className="icon-btn" aria-label="Edit run" onClick={startEdit}>
            <Pencil size={18} />
          </button>
        )}
      </header>

      {editing ? (
        <div className="card">
          <RunForm
            value={form}
            onChange={setForm}
            units={units}
            onSave={saveEdit}
            onCancel={() => setEditing(false)}
            saveLabel="Save changes"
          />
        </div>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>{formatLong(run.date)}</p>

          <div className="detail-stats">
            <div className="stat">
              <span className="stat-value">{formatDistance(run.distanceKm, units)}</span>
              <span className="stat-label">Distance</span>
            </div>
            <div className="stat">
              <span className="stat-value">{formatRunDuration(run.durationSec)}</span>
              <span className="stat-label">Time</span>
            </div>
            <div className="stat">
              <span className="stat-value">{pace != null ? formatPace(pace, units) : '—'}</span>
              <span className="stat-label">Pace</span>
            </div>
          </div>

          <div className="pr-row">
            <div className="pr-name">Effort</div>
            <div className="pr-value">
              RPE {run.rpe}
              <span className="muted" style={{ fontWeight: 400 }}> · {rpeLabel}</span>
            </div>
          </div>
          {run.runType && (
            <div className="pr-row">
              <div className="pr-name">Type</div>
              <div className="pr-value">{run.runType}</div>
            </div>
          )}

          {run.notes && (
            <section className="detail-section">
              <h2>Notes</h2>
              <p className="prewrap">{run.notes}</p>
            </section>
          )}

          <div className="form-actions">
            <button className="btn-danger full" onClick={remove}>
              <Trash2 size={18} /> Delete run
            </button>
            <Link to="/run" className="btn-secondary full">Back to running</Link>
          </div>
        </>
      )}

      {node}
    </div>
  );
}
