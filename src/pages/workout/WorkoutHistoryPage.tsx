import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Dumbbell, Flame, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { toDateKey, todayKey, formatLong } from '../../lib/dates';

interface DaySummary {
  sessionId: string;
  type: string;
  movements: string[];
  wods: string[];
}

export default function WorkoutHistoryPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(todayKey());

  const sessions = useLiveQuery(() => db.sessions.toArray(), []);
  const entries = useLiveQuery(() => db.strengthEntries.toArray(), []);
  const wodResults = useLiveQuery(() => db.wodResults.toArray(), []);

  // date -> summary (only days that actually have content)
  const byDate = useMemo(() => {
    const map = new Map<string, DaySummary>();
    const sessionDate = new Map((sessions ?? []).map((s) => [s.id, s]));
    (entries ?? []).forEach((e) => {
      const s = sessionDate.get(e.sessionId);
      if (!s) return;
      const cur = map.get(s.date) ?? { sessionId: s.id, type: s.type, movements: [], wods: [] };
      cur.movements.push(e.movementName);
      map.set(s.date, cur);
    });
    (wodResults ?? []).forEach((r) => {
      const s = sessionDate.get(r.sessionId);
      const cur = map.get(r.date) ?? { sessionId: r.sessionId, type: s?.type ?? '', movements: [], wods: [] };
      cur.wods.push(r.wodName);
      map.set(r.date, cur);
    });
    return map;
  }, [sessions, entries, wodResults]);

  const recent = useMemo(
    () => [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30),
    [byDate],
  );

  const selectedSummary = byDate.get(selected);

  return (
    <div className="page">
      <header className="page-header">
        <h1>History</h1>
      </header>

      <Calendar
        onClickDay={(d) => setSelected(toDateKey(d))}
        value={undefined}
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          return byDate.has(toDateKey(date)) ? <span className="cal-dot" aria-label="logged" /> : null;
        }}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return null;
          const key = toDateKey(date);
          const classes: string[] = [];
          if (byDate.has(key)) classes.push('has-completions');
          if (key === selected) classes.push('selected-day');
          return classes.length ? classes.join(' ') : null;
        }}
      />

      <section className="detail-section">
        <h2>{formatLong(selected)}</h2>
        {selectedSummary ? (
          <div
            className="day-item"
            onClick={() => navigate(`/workout/session/${selectedSummary.sessionId}`)}
          >
            <div style={{ flex: 1 }}>
              <div className="day-item-name">{selectedSummary.type || 'Workout'}</div>
              <div className="exercise-meta">
                {selectedSummary.movements.length > 0 && (
                  <span>
                    <Dumbbell size={13} style={{ verticalAlign: 'middle' }} />{' '}
                    {selectedSummary.movements.length} movement{selectedSummary.movements.length === 1 ? '' : 's'}
                  </span>
                )}
                {selectedSummary.wods.length > 0 && (
                  <span className={selectedSummary.movements.length ? 'dot' : ''}>
                    <Flame size={13} style={{ verticalAlign: 'middle' }} /> {selectedSummary.wods.join(', ')}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight size={18} className="muted" />
          </div>
        ) : (
          <p className="muted">Nothing logged this day.</p>
        )}
      </section>

      <h2 className="section-title">Recent sessions</h2>
      {recent.length === 0 ? (
        <p className="muted">No workouts logged yet.</p>
      ) : (
        <ul className="day-list">
          {recent.map(([date, s]) => (
            <li key={date} className="day-item" onClick={() => navigate(`/workout/session/${s.sessionId}`)}>
              <div style={{ flex: 1 }}>
                <div className="day-item-name">
                  {formatLong(date)}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {s.type || 'Workout'}
                  {s.movements.length ? ` · ${s.movements.length} lifts` : ''}
                  {s.wods.length ? ` · ${s.wods.join(', ')}` : ''}
                </div>
              </div>
              <ChevronRight size={18} className="muted" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
