import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { HeartPulse, Dumbbell, Check, Scale, Flame, Footprints, Trophy } from 'lucide-react';
import { db } from '../db';
import { todayKey, formatLong, formatShort, currentWeekKeys, streakLength } from '../lib/dates';
import { computeBmi, bmiCategory, round1 } from '../lib/bmi';
import { currentWeekDistanceKm, formatDistance, formatPace, paceSecPerKm } from '../lib/runs';
import { oneRepMaxBests } from '../lib/oneRepMax';

function WeekStrip({ activeDates, accent }: { activeDates: Set<string>; accent: string }) {
  const week = currentWeekKeys();
  const streak = streakLength(activeDates);
  return (
    <div className="week-strip">
      <div className="week-dots">
        {week.map((d, i) => (
          <div key={`${d.key}-${i}`} className={`week-day ${activeDates.has(d.key) ? 'filled' : ''}`}>
            <span className="dot-circle" />
            <span className="dot-label">{d.label}</span>
          </div>
        ))}
      </div>
      <span className="streak" style={{ color: accent }}>
        🔥 {streak}
      </span>
    </div>
  );
}

export default function HomePage() {
  const today = todayKey();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const completions = useLiveQuery(() => db.completions.toArray(), []);
  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const strengthEntries = useLiveQuery(() => db.strengthEntries.toArray(), []);
  const wodResults = useLiveQuery(() => db.wodResults.toArray(), []);
  const weights = useLiveQuery(() => db.weights.orderBy('date').toArray(), []);
  const profile = useLiveQuery(() => db.profile.get('me'), []);
  const latestRunArr = useLiveQuery(() => db.runs.orderBy('date').reverse().limit(1).toArray(), []);
  const weekRunKm = useLiveQuery(() => currentWeekDistanceKm(), []);
  const trackedLifts = useLiveQuery(() => db.trackedLifts.orderBy('order').toArray(), []);
  const ormBests = useLiveQuery(() => oneRepMaxBests(), []);

  const physioDates = useMemo(
    () => new Set((completions ?? []).map((c) => c.date)),
    [completions],
  );
  const doneTodayCount = useMemo(
    () => new Set((completions ?? []).filter((c) => c.date === today).map((c) => c.exerciseId)).size,
    [completions, today],
  );

  const workoutDates = useMemo(() => {
    const sessionDate = new Map((sessions ?? []).map((s) => [s.id, s.date]));
    const set = new Set<string>();
    (strengthEntries ?? []).forEach((e) => {
      const d = sessionDate.get(e.sessionId);
      if (d) set.add(d);
    });
    (wodResults ?? []).forEach((r) => set.add(r.date));
    return set;
  }, [sessions, strengthEntries, wodResults]);

  const exerciseCount = exercises?.length ?? 0;
  const physioAllDone = exerciseCount > 0 && doneTodayCount >= exerciseCount;
  const workoutLogged = workoutDates.has(today);

  const latest = weights && weights.length ? weights[weights.length - 1] : null;
  const prev = weights && weights.length > 1 ? weights[weights.length - 2] : null;
  const bmi = latest && profile ? computeBmi(latest.weightKg, profile.heightCm) : null;
  const delta = latest && prev ? round1(latest.weightKg - prev.weightKg) : null;

  const units = profile?.units ?? 'metric';
  const latestRun = latestRunArr && latestRunArr.length ? latestRunArr[0] : null;
  const latestRunPace = latestRun ? paceSecPerKm(latestRun) : null;
  const runGoalKm = profile?.weeklyRunGoalKm ?? null;
  const weekKm = weekRunKm ?? 0;
  // Current 1RMs for the first few tracked lifts that actually have a logged max.
  const topOrm = useMemo(() => {
    if (!trackedLifts || !ormBests) return [];
    return trackedLifts
      .map((l) => ({ name: l.name, best: ormBests.get(l.id) }))
      .filter((x): x is { name: string; best: NonNullable<typeof x.best> } => x.best != null)
      .slice(0, 3);
  }, [trackedLifts, ormBests]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Today</h1>
      </header>
      <p className="home-greeting">{formatLong(today)}</p>

      <div className="status-grid">
        <Link to="/physio" className={`status-card ${physioAllDone ? 'done' : ''}`}>
          <span className="status-head">
            <HeartPulse size={18} /> Physio
          </span>
          {exerciseCount === 0 ? (
            <span className="status-sub">No exercises yet</span>
          ) : physioAllDone ? (
            <span className="status-big">
              <Check size={22} /> Done
            </span>
          ) : (
            <>
              <span className="status-big">
                {doneTodayCount}/{exerciseCount}
              </span>
              <span className="status-sub">done today</span>
            </>
          )}
        </Link>

        <Link to="/workout" className={`status-card ${workoutLogged ? 'done' : ''}`}>
          <span className="status-head">
            <Dumbbell size={18} /> Workout
          </span>
          {workoutLogged ? (
            <span className="status-big">
              <Check size={22} /> Logged
            </span>
          ) : (
            <span className="status-sub">Not logged</span>
          )}
        </Link>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <span className="status-head">
            <HeartPulse size={16} /> Physio week
          </span>
        </div>
        <WeekStrip activeDates={physioDates} accent="#0d9488" />
        <div className="row-between" style={{ margin: '14px 0 8px' }}>
          <span className="status-head">
            <Dumbbell size={16} /> Workout week
          </span>
        </div>
        <WeekStrip activeDates={workoutDates} accent="#ea580c" />
      </div>

      <Link to="/workout/body" className="card" style={{ display: 'block', marginTop: 12, textDecoration: 'none', color: 'inherit' }}>
        <div className="row-between">
          <span className="status-head">
            <Scale size={16} /> Body
          </span>
          {bmi != null && (
            <span className="pill" style={{ background: `${bmiCategory(bmi).color}22`, color: bmiCategory(bmi).color }}>
              BMI {round1(bmi)}
            </span>
          )}
        </div>
        {latest ? (
          <div className="hero-row">
            <span className="hero-weight" style={{ fontSize: 28 }}>
              {round1(latest.weightKg)}
              <span> kg</span>
            </span>
            {delta != null && delta !== 0 && (
              <span className="hero-delta">
                {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} kg
              </span>
            )}
          </div>
        ) : (
          <p className="status-sub" style={{ marginTop: 8 }}>Tap to log your weight</p>
        )}
      </Link>

      <Link
        to="/workout/prs"
        className="card"
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, textDecoration: 'none', color: 'inherit' }}
      >
        <Flame size={18} style={{ color: '#ea580c' }} />
        <span style={{ fontWeight: 600 }}>Personal records</span>
        <span className="status-sub" style={{ marginLeft: 'auto' }}>View →</span>
      </Link>

      <Link to="/run" className="card" style={{ display: 'block', marginTop: 12, textDecoration: 'none', color: 'inherit' }}>
        <div className="row-between">
          <span className="status-head">
            <Footprints size={16} /> Running
          </span>
          <span className="status-sub">
            {formatDistance(weekKm, units)}
            {runGoalKm && runGoalKm > 0 ? ` / ${formatDistance(runGoalKm, units)}` : ''} this week
          </span>
        </div>
        {latestRun ? (
          <div className="hero-row">
            <span className="hero-weight" style={{ fontSize: 24 }}>
              {formatDistance(latestRun.distanceKm, units)}
            </span>
            <span className="hero-delta">
              {latestRunPace != null ? `${formatPace(latestRunPace, units)} · ` : ''}
              {formatShort(latestRun.date)}
            </span>
          </div>
        ) : (
          <p className="status-sub" style={{ marginTop: 8 }}>Tap to log a run</p>
        )}
      </Link>

      {topOrm.length > 0 && (
        <Link to="/workout/prs" className="card" style={{ display: 'block', marginTop: 12, textDecoration: 'none', color: 'inherit' }}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <span className="status-head">
              <Trophy size={16} /> 1RM
            </span>
            <span className="status-sub">View →</span>
          </div>
          {topOrm.map((o) => (
            <div key={o.name} className="row-between" style={{ padding: '3px 0' }}>
              <span>{o.name}</span>
              <strong>{round1(o.best.best1RM)} kg</strong>
            </div>
          ))}
        </Link>
      )}
    </div>
  );
}
