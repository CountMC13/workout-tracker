import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Minus, Trash2, X, Check, Copy, Flame, Percent } from 'lucide-react';
import {
  db,
  getOrCreateSession,
  updateSession,
  addStrengthEntry,
  updateStrengthEntry,
  removeStrengthEntry,
  restoreStrengthEntry,
  deleteSession,
  ensureMovement,
  copyLastStrengthInto,
  deleteWodResult,
  restoreWodResult,
} from '../db';
import { SESSION_TYPES, FELT_OPTIONS } from '../constants';
import type { StrengthEntry, StrengthSet, Felt, Movement, WodResult } from '../types';
import { detectStrengthPR, formatWodScore } from '../lib/prs';
import { oneRepMaxBests, weightForPercent, type OneRepMaxBest } from '../lib/oneRepMax';
import { round1 } from '../lib/bmi';
import { useToast } from '../hooks/useToast';

// Reference-only working-weight helper: pick a single % (in 2.5% steps or a custom
// value) or a % range and see the resulting weight(s) for this movement's best 1RM.
// Nothing is written — it just shows the kg so you know what to load.
function PercentCalc({ oneRM }: { oneRM: number }) {
  const [mode, setMode] = useState<'single' | 'range'>('single');
  const [pct, setPct] = useState(80);
  const [low, setLow] = useState(75);
  const [high, setHigh] = useState(90);

  const stepPct = (delta: number) => setPct((p) => Math.max(0, Math.round((p + delta) / 2.5) * 2.5));
  const clampPct = (v: number) => Math.min(300, Math.max(0, v || 0));

  return (
    <div className="pct-calc">
      <div className="toggle2" style={{ marginBottom: 10 }}>
        <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>Single %</button>
        <button className={mode === 'range' ? 'active' : ''} onClick={() => setMode('range')}>Range</button>
      </div>

      {mode === 'single' ? (
        <>
          <div className="num-stepper">
            <button className="step-btn" aria-label="−2.5%" onClick={() => stepPct(-2.5)}>
              <Minus size={20} />
            </button>
            <span className="num-display">
              {pct}
              <small> %</small>
            </span>
            <button className="step-btn" aria-label="+2.5%" onClick={() => stepPct(2.5)}>
              <Plus size={20} />
            </button>
          </div>
          <label className="field" style={{ marginTop: 8 }}>
            <span>Custom %</span>
            <input
              type="number"
              inputMode="decimal"
              value={pct}
              onChange={(e) => setPct(clampPct(Number(e.target.value)))}
              aria-label="Custom percent"
            />
          </label>
          <p className="pct-result">
            {pct}% of {round1(oneRM)} kg = <strong>{weightForPercent(oneRM, pct)} kg</strong>
          </p>
        </>
      ) : (
        <>
          <div className="field-row">
            <label className="field">
              <span>Low %</span>
              <input
                type="number"
                inputMode="numeric"
                value={low}
                onChange={(e) => setLow(clampPct(Number(e.target.value)))}
                aria-label="Low percent"
              />
            </label>
            <label className="field">
              <span>High %</span>
              <input
                type="number"
                inputMode="numeric"
                value={high}
                onChange={(e) => setHigh(clampPct(Number(e.target.value)))}
                aria-label="High percent"
              />
            </label>
          </div>
          <p className="pct-result">
            {low}–{high}% of {round1(oneRM)} kg ={' '}
            <strong>{weightForPercent(oneRM, low)}–{weightForPercent(oneRM, high)} kg</strong>
          </p>
        </>
      )}
    </div>
  );
}

function StrengthEntryCard({
  entry,
  best,
  onPR,
  onRemove,
}: {
  entry: StrengthEntry;
  best: OneRepMaxBest | undefined;
  onPR: (m: string) => void;
  onRemove: () => void;
}) {
  const [sets, setSets] = useState<StrengthSet[]>(entry.sets);
  const [felt, setFelt] = useState<Felt | null>(entry.felt);
  const [showPct, setShowPct] = useState(false);
  const repsRefs = useRef<(HTMLInputElement | null)[]>([]);

  const persist = (next: StrengthSet[]) => {
    setSets(next);
    updateStrengthEntry(entry.id, { sets: next });
  };
  const setReps = (i: number, v: number) => persist(sets.map((s, idx) => (idx === i ? { ...s, reps: v } : s)));
  const setWeight = (i: number, v: number | null) =>
    persist(sets.map((s, idx) => (idx === i ? { ...s, weightKg: v } : s)));
  const toggleDone = (i: number) => {
    persist(sets.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s)));
  };
  const addSet = () => {
    const last = sets[sets.length - 1] ?? { reps: 5, weightKg: null, done: false };
    const next = [...sets, { ...last, done: false }];
    persist(next);
    // Focus the new row's reps field so logging another set is type-only.
    requestAnimationFrame(() => {
      const el = repsRefs.current[next.length - 1];
      el?.focus();
      el?.select();
    });
  };
  const removeSet = (i: number) => persist(sets.filter((_, idx) => idx !== i));

  const chooseFelt = async (f: Felt) => {
    setFelt(f);
    await updateStrengthEntry(entry.id, { felt: f });
    if (await detectStrengthPR({ ...entry, sets, felt: f })) onPR(`PR! ${entry.movementName}`);
  };

  return (
    <div className="entry-card">
      <div className="entry-head">
        <h3>
          {entry.movementName}
          {best && (
            <span className="entry-1rm">1RM {round1(best.best1RM)} kg</span>
          )}
        </h3>
        <button className="icon-btn danger" aria-label="Remove movement" onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </div>

      {sets.map((s, i) => (
        <div className="set-row" key={i}>
          <span className="set-idx">{i + 1}</span>
          <input
            ref={(el) => {
              repsRefs.current[i] = el;
            }}
            type="number"
            inputMode="numeric"
            value={s.reps || ''}
            onChange={(e) => setReps(i, Number(e.target.value))}
            placeholder="reps"
            aria-label={`Set ${i + 1} reps`}
          />
          <span className="set-x">×</span>
          <input
            type="number"
            inputMode="decimal"
            value={s.weightKg ?? ''}
            onChange={(e) => setWeight(i, e.target.value === '' ? null : Number(e.target.value))}
            placeholder="kg"
            aria-label={`Set ${i + 1} weight`}
          />
          <button
            className={`set-check ${s.done ? 'on' : ''}`}
            aria-label="Mark set done"
            onClick={() => toggleDone(i)}
          >
            <Check size={18} />
          </button>
          {sets.length > 1 && (
            <button className="icon-btn" aria-label="Remove set" onClick={() => removeSet(i)}>
              <X size={16} />
            </button>
          )}
        </div>
      ))}

      <button className="btn-secondary full" style={{ marginTop: 8 }} onClick={addSet}>
        <Plus size={16} /> Add set
      </button>

      <button
        className="btn-secondary full"
        style={{ marginTop: 8 }}
        aria-expanded={showPct}
        onClick={() => setShowPct((s) => !s)}
      >
        <Percent size={15} /> % of 1RM
      </button>
      {showPct && (
        best ? (
          <PercentCalc oneRM={best.best1RM} />
        ) : (
          <p className="muted center" style={{ margin: '8px 0 0', fontSize: 13 }}>
            Log a 1RM for {entry.movementName} (PRs → 1RM) to use the % calculator.
          </p>
        )
      )}

      <div className="felt-row">
        {FELT_OPTIONS.map((f) => (
          <button
            key={f.value}
            className={`felt-btn ${felt === f.value ? 'active' : ''}`}
            onClick={() => chooseFelt(f.value)}
          >
            <span className="felt-emoji">{f.emoji}</span>
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MovementPicker({ onPick, onClose }: { onPick: (m: Movement) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const movements = useLiveQuery(() => db.movements.orderBy('name').toArray(), []);
  const filtered = useMemo(() => {
    const list = movements ?? [];
    if (!q.trim()) return list;
    return list.filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()));
  }, [movements, q]);

  const pickNew = async () => {
    const m = await ensureMovement(q);
    onPick(m);
  };

  return (
    <div className="card stack" style={{ marginTop: 8 }}>
      <div className="row-between">
        <input autoFocus placeholder="Search or add a movement…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="filter-row" style={{ flexWrap: 'wrap', overflow: 'visible' }}>
        {filtered.slice(0, 30).map((m) => (
          <button key={m.id} className="filter-chip" onClick={() => onPick(m)}>
            {m.name}
          </button>
        ))}
      </div>
      {q.trim() && !filtered.some((m) => m.name.toLowerCase() === q.trim().toLowerCase()) && (
        <button className="btn-secondary full" onClick={pickNew}>
          <Plus size={16} /> Add "{q.trim()}"
        </button>
      )}
    </div>
  );
}

export default function SessionView({ date, sessionId }: { date: string; sessionId: string | null }) {
  const navigate = useNavigate();
  const { show, node } = useToast();
  const [picking, setPicking] = useState(false);

  const session = useLiveQuery(() => (sessionId ? db.sessions.get(sessionId) : undefined), [sessionId]);
  const entries = useLiveQuery(
    () => (sessionId ? db.strengthEntries.where('sessionId').equals(sessionId).sortBy('order') : []),
    [sessionId],
  );
  const wodResults = useLiveQuery(() => db.wodResults.where('date').equals(date).toArray(), [date]);

  // Current best 1RM per lift, keyed by lower-cased lift name, so a strength entry
  // can show the 1RM for the matching tracked lift next to its name.
  const bests = useLiveQuery(() => oneRepMaxBests(), []);
  const bestByName = useMemo(() => {
    const m = new Map<string, OneRepMaxBest>();
    for (const b of bests?.values() ?? []) m.set(b.liftName.toLowerCase(), b);
    return m;
  }, [bests]);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;
    const s = await getOrCreateSession(date);
    return s.id;
  };

  const onPickMovement = async (m: Movement) => {
    const sid = await ensureSession();
    await addStrengthEntry(sid, m);
    setPicking(false);
  };

  const onCopyLast = async () => {
    const sid = await ensureSession();
    const n = await copyLastStrengthInto(sid, date);
    show(n > 0 ? `Copied ${n} movement${n === 1 ? '' : 's'}` : 'No earlier session to copy');
  };

  const onType = async (type: string) => {
    const sid = await ensureSession();
    await updateSession(sid, { type });
  };

  const onDeleteSession = async () => {
    if (!sessionId) return;
    if (confirm('Delete this whole session?')) {
      await deleteSession(sessionId);
      navigate('/workout/history');
    }
  };

  // Delete now, but offer a 5s undo so an accidental tap doesn't lose data.
  const removeEntry = (e: StrengthEntry) => {
    removeStrengthEntry(e.id);
    show(`Removed ${e.movementName}`, {
      actionLabel: 'Undo',
      onAction: () => restoreStrengthEntry(e),
      durationMs: 5000,
    });
  };
  const removeWod = (r: WodResult) => {
    deleteWodResult(r.id);
    show(`Removed ${r.wodName}`, {
      actionLabel: 'Undo',
      onAction: () => restoreWodResult(r),
      durationMs: 5000,
    });
  };

  const hasContent = (entries?.length ?? 0) > 0 || (wodResults?.length ?? 0) > 0;

  return (
    <>
      <label className="field" style={{ marginBottom: 14 }}>
        <span>Session type</span>
        <input
          list="session-types"
          value={session?.type ?? ''}
          onChange={(e) => onType(e.target.value)}
          placeholder="e.g. Weightlifting"
        />
        <datalist id="session-types">
          {SESSION_TYPES.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>

      {/* Strength */}
      <div className="row-between">
        <h2 className="section-title" style={{ margin: 0 }}>Strength</h2>
        <button className="btn-secondary" onClick={onCopyLast}>
          <Copy size={15} /> Copy last
        </button>
      </div>

      {entries?.map((e) => (
        <StrengthEntryCard
          key={e.id}
          entry={e}
          best={bestByName.get(e.movementName.toLowerCase())}
          onPR={show}
          onRemove={() => removeEntry(e)}
        />
      ))}

      {picking ? (
        <MovementPicker onPick={onPickMovement} onClose={() => setPicking(false)} />
      ) : (
        <button className="btn-primary full tap" style={{ marginTop: 12 }} onClick={() => setPicking(true)}>
          <Plus size={18} /> Add movement
        </button>
      )}

      {/* WODs */}
      <div className="row-between" style={{ marginTop: 22 }}>
        <h2 className="section-title" style={{ margin: 0 }}>WODs</h2>
        <button className="btn-secondary" onClick={() => navigate('/workout/wods')}>
          <Flame size={15} /> Log a WOD
        </button>
      </div>
      {wodResults && wodResults.length > 0 ? (
        <ul className="history-list">
          {wodResults.map((r) => (
            <li key={r.id}>
              <span style={{ flex: 1 }}>
                {r.wodName} <span className="muted">· {r.rxStatus === 'rx' ? 'Rx' : 'Scaled'}</span>
              </span>
              <span style={{ fontWeight: 700 }}>{formatWodScore(r)}</span>
              <button className="icon-btn danger" aria-label="Delete result" onClick={() => removeWod(r)}>
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No WOD logged for this day.</p>
      )}

      {sessionId && hasContent && (
        <button className="btn-danger full" style={{ marginTop: 24 }} onClick={onDeleteSession}>
          <Trash2 size={18} /> Delete session
        </button>
      )}

      {node}
    </>
  );
}
