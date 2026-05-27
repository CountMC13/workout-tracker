import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Minus, Info, Trash2, Settings } from 'lucide-react';
import { db, upsertWeight, deleteWeight } from '../db';
import { todayKey, toDateKey, formatShort } from '../lib/dates';
import { computeBmi, bmiCategory, round1 } from '../lib/bmi';
import WeightChart from '../components/WeightChart';

type Range = '30d' | '90d' | '1y' | 'all';
const RANGES: { key: Range; label: string; days: number | null }[] = [
  { key: '30d', label: '30d', days: 30 },
  { key: '90d', label: '90d', days: 90 },
  { key: '1y', label: '1y', days: 365 },
  { key: 'all', label: 'All', days: null },
];

export default function BodyPage() {
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), []);

  const [logging, setLogging] = useState(false);
  const [logDate, setLogDate] = useState(todayKey());
  const [value, setValue] = useState<number>(75);
  const [range, setRange] = useState<Range>('90d');
  const [showCaveat, setShowCaveat] = useState(false);

  const latest = weights && weights.length ? weights[weights.length - 1] : null;
  const prev = weights && weights.length > 1 ? weights[weights.length - 2] : null;
  const height = profile?.heightCm ?? null;
  const goal = profile?.goalWeightKg ?? null;
  const bmi = latest && height ? computeBmi(latest.weightKg, height) : null;
  const band = bmi != null ? bmiCategory(bmi) : null;
  const delta = latest && prev ? round1(latest.weightKg - prev.weightKg) : null;
  const toGoal = latest && goal != null ? round1(latest.weightKg - goal) : null;

  const ranged = useMemo(() => {
    if (!weights) return [];
    const r = RANGES.find((x) => x.key === range)!;
    if (r.days == null) return weights;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - r.days);
    const cutoffKey = toDateKey(cutoff);
    return weights.filter((w) => w.date >= cutoffKey);
  }, [weights, range]);

  const openLog = () => {
    const existingToday = weights?.find((w) => w.date === todayKey());
    setValue(existingToday?.weightKg ?? latest?.weightKg ?? 75);
    setLogDate(todayKey());
    setLogging(true);
  };

  const save = async () => {
    if (value > 0) await upsertWeight(logDate, round1(value));
    setLogging(false);
  };

  const todayHasEntry = !!weights?.find((w) => w.date === todayKey());

  return (
    <div className="page">
      <header className="page-header">
        <h1>Body</h1>
        <Link to="/settings" className="icon-btn" aria-label="Profile settings">
          <Settings size={20} />
        </Link>
      </header>

      {/* Hero */}
      <div className="card hero">
        {latest ? (
          <>
            <div className="hero-weight">
              {round1(latest.weightKg)}
              <span> kg</span>
            </div>
            <div className="hero-row">
              {band && bmi != null ? (
                <>
                  <span className="pill" style={{ background: `${band.color}22`, color: band.color }}>
                    BMI {round1(bmi)} · {band.label}
                  </span>
                  <button className="info-btn" aria-label="About BMI" onClick={() => setShowCaveat((s) => !s)}>
                    <Info size={14} />
                  </button>
                </>
              ) : (
                <Link to="/settings" className="pill" style={{ background: 'var(--bg)', color: 'var(--muted)' }}>
                  Set your height to see BMI
                </Link>
              )}
            </div>
            <div className="hero-row">
              {delta != null && delta !== 0 && (
                <span className={`hero-delta ${goal != null && Math.sign(delta) === Math.sign(goal - latest.weightKg) ? 'good' : ''}`}>
                  {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} kg since last
                </span>
              )}
              {toGoal != null && toGoal !== 0 && (
                <span className="hero-delta">
                  {Math.abs(toGoal)} kg {toGoal > 0 ? 'to goal' : 'under goal'}
                </span>
              )}
            </div>
            {showCaveat && (
              <p className="caveat">
                BMI doesn't distinguish muscle from fat. With high muscle mass (common in CrossFit), an
                "overweight" BMI can be perfectly healthy — track the trend, not the label.
              </p>
            )}
          </>
        ) : (
          <p className="muted center" style={{ padding: '12px 0' }}>No weigh-ins yet. Log your first below.</p>
        )}
      </div>

      {/* Chart */}
      {weights && weights.length >= 2 && (
        <>
          <div className="range-row">
            {RANGES.map((r) => (
              <button
                key={r.key}
                className={`filter-chip ${range === r.key ? 'active' : ''}`}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="card">
            <WeightChart entries={ranged} goalKg={goal} />
          </div>
        </>
      )}

      {/* Log */}
      {logging ? (
        <div className="card log-inline" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Date</span>
            <input type="date" value={logDate} max={todayKey()} onChange={(e) => setLogDate(e.target.value)} />
          </label>
          <div className="num-stepper">
            <button className="step-btn" aria-label="−0.1" onClick={() => setValue((v) => round1(Math.max(0, v - 0.1)))}>
              <Minus size={22} />
            </button>
            <span className="num-display">
              {round1(value)}
              <small> kg</small>
            </span>
            <button className="step-btn" aria-label="+0.1" onClick={() => setValue((v) => round1(v + 0.1))}>
              <Plus size={22} />
            </button>
          </div>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            aria-label="Weight in kg"
          />
          <div className="form-actions">
            <button className="btn-primary full tap" onClick={save}>Save</button>
            <button className="btn-secondary full" onClick={() => setLogging(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-primary full tap" style={{ marginTop: 12 }} onClick={openLog}>
          <Plus size={18} /> {todayHasEntry ? 'Update today' : 'Log weight'}
        </button>
      )}

      {/* Recent */}
      {weights && weights.length > 0 && (
        <>
          <h2 className="section-title">Recent</h2>
          <ul className="history-list">
            {[...weights].reverse().slice(0, 12).map((w) => (
              <li key={w.id}>
                <span style={{ flex: 1 }}>{formatShort(w.date)}</span>
                <span style={{ fontWeight: 700 }}>{round1(w.weightKg)} kg</span>
                <button
                  className="icon-btn danger"
                  aria-label="Delete entry"
                  onClick={() => deleteWeight(w.id)}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
