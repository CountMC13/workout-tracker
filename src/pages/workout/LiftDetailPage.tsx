import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Minus, Pencil, Trash2 } from 'lucide-react';
import {
  db,
  getProfile,
  logOneRepMax,
  updateOneRepMax,
  deleteOneRepMax,
  restoreOneRepMax,
} from '../../db';
import {
  oneRepMaxBests,
  oneRepMaxHistory,
  oneRepMaxValue,
  percentTable,
  platesFor,
} from '../../lib/oneRepMax';
import { estimate1RM } from '../../lib/prs';
import { round1 } from '../../lib/bmi';
import { todayKey, formatShort } from '../../lib/dates';
import { useToast } from '../../hooks/useToast';
import { DEFAULT_BAR_KG } from '../../constants';
import TrendChart from '../../components/TrendChart';
import type { OneRepMax } from '../../types';

type Tab = 'entries' | 'graph';
interface FormValues { weightKg: number; reps: number; date: string; note: string }

// Shared weight / reps / date / note form used to both log a new 1RM and edit an
// existing one. The weight stepper is the same ±2.5 kg control as elsewhere.
function EntryForm({
  initial,
  saveLabel,
  onSave,
  onCancel,
}: {
  initial: FormValues;
  saveLabel: string;
  onSave: (v: FormValues) => void;
  onCancel: () => void;
}) {
  const [weight, setWeight] = useState(initial.weightKg);
  const [reps, setReps] = useState(initial.reps);
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);

  const preview = reps > 1 && weight > 0 ? round1(estimate1RM(weight, reps)) : null;

  const save = () => {
    if (weight <= 0) return;
    onSave({ weightKg: round1(weight), reps, date, note: note.trim() });
  };

  return (
    <div className="log-inline" style={{ marginTop: 12 }}>
      <div className="num-stepper">
        <button className="step-btn" aria-label="−2.5 kg" onClick={() => setWeight((w) => round1(Math.max(0, w - 2.5)))}>
          <Minus size={22} />
        </button>
        <span className="num-display">
          {round1(weight)}
          <small> kg</small>
        </span>
        <button className="step-btn" aria-label="+2.5 kg" onClick={() => setWeight((w) => round1(w + 2.5))}>
          <Plus size={22} />
        </button>
      </div>
      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        value={weight}
        onChange={(e) => setWeight(Number(e.target.value))}
        aria-label="Weight in kg"
      />
      <div className="field-row">
        <label className="field">
          <span>Reps</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={reps}
            onChange={(e) => setReps(Math.max(1, Math.round(Number(e.target.value) || 1)))}
            aria-label="Reps"
          />
        </label>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12 }}>
        {preview != null ? `Reps > 1 logs an estimate (≈ ${preview} kg 1RM).` : 'Reps > 1 logs an estimate.'}
      </p>
      <label className="field">
        <span>Note (optional)</span>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
      </label>
      <div className="form-actions">
        <button className="btn-primary full tap" onClick={save}>{saveLabel}</button>
        <button className="btn-secondary full" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// Detail view for one tracked lift: current best, a tabbed Entries / Graph view
// (each entry editable & deletable), a logger, and a working-set % + plate helper.
export default function LiftDetailPage() {
  const { liftId = '' } = useParams();
  const { show, node } = useToast();

  const lift = useLiveQuery(async () => (liftId ? (await db.trackedLifts.get(liftId)) ?? null : null), [liftId]);
  const best = useLiveQuery(async () => (await oneRepMaxBests()).get(liftId), [liftId]);
  const entries = useLiveQuery(async () => {
    const list = await db.oneRepMaxes.where('liftId').equals(liftId).toArray();
    return list.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  }, [liftId]);
  const history = useLiveQuery(() => oneRepMaxHistory(liftId), [liftId]);
  const profile = useLiveQuery(() => getProfile(), []);
  const barKg = profile?.barWeightKg ?? DEFAULT_BAR_KG;

  const [tab, setTab] = useState<Tab>('entries');
  const [logging, setLogging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCalc, setShowCalc] = useState(false);
  const [target, setTarget] = useState<number | null>(null);

  if (lift === undefined) return <div className="page" />; // loading

  if (lift === null) {
    return (
      <div className="page">
        <header className="page-header">
          <Link to="/workout/prs" className="icon-btn" aria-label="Back to PRs">
            <ArrowLeft size={20} />
          </Link>
          <h1>Lift</h1>
        </header>
        <p className="muted center" style={{ padding: '24px 0' }}>Lift not found.</p>
        <Link to="/workout/prs" className="btn-secondary full">Back to PRs</Link>
      </div>
    );
  }

  const saveNew = async (v: FormValues) => {
    const prior = best?.best1RM ?? 0;
    const candidate = estimate1RM(v.weightKg, v.reps);
    await logOneRepMax({ liftId: lift.id, liftName: lift.name, date: v.date, weightKg: v.weightKg, reps: v.reps, note: v.note });
    if (round1(candidate) > prior) show('New 1RM!');
    setLogging(false);
  };

  const saveEdit = async (id: string, v: FormValues) => {
    await updateOneRepMax(id, v);
    setEditingId(null);
    show('Entry updated');
  };

  const remove = (o: OneRepMax) => {
    deleteOneRepMax(o.id);
    show(`Removed ${round1(o.weightKg)} kg × ${o.reps}`, {
      actionLabel: 'Undo',
      onAction: () => restoreOneRepMax(o),
      durationMs: 5000,
    });
  };

  const effectiveTarget = target ?? best?.best1RM ?? null;
  const plates = effectiveTarget != null ? platesFor(effectiveTarget, barKg) : null;
  const percentRows = best?.best1RM != null ? percentTable(best.best1RM) : [];

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/workout/prs" className="icon-btn" aria-label="Back to PRs">
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ flex: 1 }}>{lift.name}</h1>
      </header>

      <div className="pr-row" style={{ marginTop: 0 }}>
        <div className="pr-name">Best 1RM</div>
        <div style={{ textAlign: 'right' }}>
          {best ? (
            <>
              <div className="pr-value">{round1(best.best1RM)} kg</div>
              <div className="pr-sub">
                {round1(best.bestWeightKg)} kg × {best.bestReps}
                {best.bestEstimated && ' · est.'} · {formatShort(best.bestDate)}
              </div>
            </>
          ) : (
            <div className="pr-sub">No 1RM logged</div>
          )}
        </div>
      </div>

      {logging ? (
        <EntryForm
          initial={{ weightKg: best?.bestWeightKg ?? 60, reps: 1, date: todayKey(), note: '' }}
          saveLabel="Save"
          onSave={(v) => void saveNew(v)}
          onCancel={() => setLogging(false)}
        />
      ) : (
        <button className="btn-primary full tap" style={{ marginTop: 12 }} onClick={() => setLogging(true)}>
          <Plus size={18} /> Log 1RM
        </button>
      )}

      <div className="toggle2" style={{ margin: '16px 0 4px' }}>
        <button className={tab === 'entries' ? 'active' : ''} onClick={() => setTab('entries')}>Entries</button>
        <button className={tab === 'graph' ? 'active' : ''} onClick={() => setTab('graph')}>Graph</button>
      </div>

      {tab === 'entries' && (
        <>
          {!entries || entries.length === 0 ? (
            <p className="muted center" style={{ padding: '16px 0' }}>No entries yet. Log your first 1RM above.</p>
          ) : (
            entries.map((o) =>
              editingId === o.id ? (
                <div key={o.id} className="card" style={{ marginTop: 10 }}>
                  <EntryForm
                    initial={{ weightKg: o.weightKg, reps: o.reps, date: o.date, note: o.note }}
                    saveLabel="Save changes"
                    onSave={(v) => void saveEdit(o.id, v)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <div key={o.id} className="orm-entry">
                  <div style={{ flex: 1 }}>
                    <div className="pr-name">
                      {round1(o.weightKg)} kg × {o.reps}
                      {o.estimated && <span className="muted" style={{ fontWeight: 400 }}> · est. 1RM {round1(oneRepMaxValue(o))} kg</span>}
                    </div>
                    <div className="pr-sub">
                      {formatShort(o.date)}
                      {o.note && ` · ${o.note}`}
                    </div>
                  </div>
                  <button className="icon-btn" aria-label="Edit entry" onClick={() => setEditingId(o.id)}>
                    <Pencil size={16} />
                  </button>
                  <button className="icon-btn danger" aria-label="Delete entry" onClick={() => remove(o)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            )
          )}
        </>
      )}

      {tab === 'graph' && (
        <div style={{ marginTop: 12 }}>
          <TrendChart
            points={history ?? []}
            formatY={(v) => `${v} kg`}
            ariaLabel={`${lift.name} 1RM trend`}
            emptyHint="Log at least two 1RMs to see a trend."
          />
        </div>
      )}

      <button
        className="btn-secondary full"
        style={{ marginTop: 16 }}
        aria-expanded={showCalc}
        onClick={() => setShowCalc((s) => !s)}
      >
        % &amp; plates
      </button>

      {showCalc && (
        <div style={{ marginTop: 12 }}>
          {best?.best1RM == null ? (
            <p className="muted center" style={{ margin: 0 }}>Log a 1RM first to see working sets.</p>
          ) : (
            <>
              <ul className="orm-percent-list">
                {percentRows.map((r) => {
                  const active = effectiveTarget != null && Math.abs(effectiveTarget - r.weightKg) < 0.01;
                  return (
                    <li key={r.percent}>
                      <button className={`orm-percent-row ${active ? 'active' : ''}`} onClick={() => setTarget(r.weightKg)}>
                        <span className="orm-percent-pct">{r.percent}%</span>
                        <span className="orm-percent-kg">{round1(r.weightKg)} kg</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {plates && effectiveTarget != null && (
                <div className="orm-plates">
                  <div className="pr-sub">Loading {round1(effectiveTarget)} kg on a {round1(barKg)} kg bar</div>
                  {plates.perSide.length > 0 ? (
                    <div className="chips" style={{ marginTop: 6 }}>
                      {plates.perSide.map((p) => (
                        <span key={p.plate} className="chip orm-plate-chip">{p.plate}×{p.count}</span>
                      ))}
                      <span className="chip orm-plate-chip">/ side</span>
                    </div>
                  ) : (
                    <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>Just the bar.</p>
                  )}
                  <div className="pr-sub" style={{ marginTop: 6 }}>
                    Achievable {round1(plates.achievableKg)} kg
                    {plates.leftoverKg > 0 && ` (${round1(plates.leftoverKg)} kg short)`}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {node}
    </div>
  );
}
