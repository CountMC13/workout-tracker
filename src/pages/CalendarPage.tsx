import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { Check } from 'lucide-react';
import { db } from '../db';
import { MUSCLE_GROUPS } from '../constants';
import { toDateKey, todayKey, formatLong } from '../lib/dates';
import { MuscleChips } from '../components/MuscleChips';
import type { Exercise } from '../types';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(todayKey());
  const [exerciseFilter, setExerciseFilter] = useState<string>('all');
  const [tagFilters, setTagFilters] = useState<string[]>([]);

  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);
  const completions = useLiveQuery(() => db.completions.toArray(), []);

  const exMap = useMemo(() => {
    const m = new Map<string, Exercise>();
    (exercises ?? []).forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);

  const usedTags = useMemo(() => {
    const set = new Set<string>(MUSCLE_GROUPS);
    (exercises ?? []).forEach((e) => e.muscleGroups.forEach((t) => set.add(t)));
    return [...set];
  }, [exercises]);

  // A completion passes the current filters if its exercise matches.
  const matches = useMemo(() => {
    return (exerciseId: string): boolean => {
      const ex = exMap.get(exerciseId);
      if (!ex) return false;
      if (exerciseFilter !== 'all' && ex.id !== exerciseFilter) return false;
      if (tagFilters.length && !tagFilters.some((t) => ex.muscleGroups.includes(t))) return false;
      return true;
    };
  }, [exMap, exerciseFilter, tagFilters]);

  // date key -> count of matching completions (for calendar dots)
  const byDate = useMemo(() => {
    const m = new Map<string, number>();
    (completions ?? []).forEach((c) => {
      if (matches(c.exerciseId)) m.set(c.date, (m.get(c.date) ?? 0) + 1);
    });
    return m;
  }, [completions, matches]);

  const selectedList = useMemo(() => {
    return (completions ?? [])
      .filter((c) => c.date === selected && matches(c.exerciseId))
      .map((c) => exMap.get(c.exerciseId))
      .filter((e): e is Exercise => !!e)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [completions, selected, matches, exMap]);

  const toggleTag = (tag: string) =>
    setTagFilters((f) => (f.includes(tag) ? f.filter((x) => x !== tag) : [...f, tag]));

  return (
    <div className="page">
      <header className="page-header">
        <h1>Calendar</h1>
      </header>

      <div className="cal-filters">
        <select value={exerciseFilter} onChange={(e) => setExerciseFilter(e.target.value)}>
          <option value="all">All exercises</option>
          {(exercises ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <div className="filter-row">
          <button
            className={`filter-chip ${tagFilters.length === 0 ? 'active' : ''}`}
            onClick={() => setTagFilters([])}
          >
            All tags
          </button>
          {usedTags.map((tag) => (
            <button
              key={tag}
              className={`filter-chip ${tagFilters.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <Calendar
        onClickDay={(d) => setSelected(toDateKey(d))}
        value={undefined}
        tileContent={({ date, view }) => {
          if (view !== 'month') return null;
          const count = byDate.get(toDateKey(date));
          return count ? <span className="cal-dot" aria-label={`${count} completed`} /> : null;
        }}
        tileClassName={({ date, view }) => {
          if (view !== 'month') return null;
          const key = toDateKey(date);
          const classes: string[] = [];
          if (byDate.get(key)) classes.push('has-completions');
          if (key === selected) classes.push('selected-day');
          return classes.length ? classes.join(' ') : null;
        }}
      />

      <section className="detail-section">
        <h2>{formatLong(selected)}</h2>
        {selectedList.length > 0 ? (
          <ul className="day-list">
            {selectedList.map((ex) => (
              <li key={ex.id} className="day-item" onClick={() => navigate(`/physio/exercise/${ex.id}`)}>
                <Check size={18} className="history-check" />
                <div>
                  <div className="day-item-name">{ex.name}</div>
                  <MuscleChips tags={ex.muscleGroups} small />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No completions logged for this day.</p>
        )}
      </section>
    </div>
  );
}
