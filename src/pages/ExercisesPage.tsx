import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Check, Pencil, Dumbbell } from 'lucide-react';
import { db, toggleCompletion } from '../db';
import { MUSCLE_GROUPS } from '../constants';
import { todayKey } from '../lib/dates';
import { MuscleChips } from '../components/MuscleChips';

export default function ExercisesPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<string[]>([]);

  const exercises = useLiveQuery(() => db.exercises.orderBy('order').toArray(), []);
  const today = todayKey();
  const doneToday = useLiveQuery(
    () => db.completions.where('date').equals(today).toArray(),
    [today],
  );
  const doneSet = useMemo(
    () => new Set((doneToday ?? []).map((c) => c.exerciseId)),
    [doneToday],
  );

  // Only show filter tags that are actually in use, plus presets.
  const usedTags = useMemo(() => {
    const set = new Set<string>(MUSCLE_GROUPS);
    (exercises ?? []).forEach((e) => e.muscleGroups.forEach((t) => set.add(t)));
    return [...set];
  }, [exercises]);

  const visible = useMemo(() => {
    if (!exercises) return [];
    if (!filters.length) return exercises;
    return exercises.filter((e) => filters.some((f) => e.muscleGroups.includes(f)));
  }, [exercises, filters]);

  const toggleFilter = (tag: string) =>
    setFilters((f) => (f.includes(tag) ? f.filter((x) => x !== tag) : [...f, tag]));

  return (
    <div className="page">
      <header className="page-header">
        <h1>Exercises</h1>
        <button className="btn-primary" onClick={() => navigate('/physio/exercise/new')}>
          <Plus size={18} /> Add
        </button>
      </header>

      {exercises && exercises.length > 0 && (
        <div className="filter-row" role="group" aria-label="Filter by muscle group">
          <button
            className={`filter-chip ${filters.length === 0 ? 'active' : ''}`}
            onClick={() => setFilters([])}
          >
            All
          </button>
          {usedTags.map((tag) => (
            <button
              key={tag}
              className={`filter-chip ${filters.includes(tag) ? 'active' : ''}`}
              onClick={() => toggleFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {exercises && exercises.length === 0 && (
        <div className="empty-state">
          <Dumbbell size={40} />
          <h2>No exercises yet</h2>
          <p>Add your first physio exercise and attach its video.</p>
          <button className="btn-primary" onClick={() => navigate('/physio/exercise/new')}>
            <Plus size={18} /> Add exercise
          </button>
        </div>
      )}

      {visible.length === 0 && exercises && exercises.length > 0 && (
        <p className="muted center">No exercises match the selected tags.</p>
      )}

      <ul className="exercise-list">
        {visible.map((ex) => {
          const done = doneSet.has(ex.id);
          return (
            <li key={ex.id} className="exercise-card" onClick={() => navigate(`/physio/exercise/${ex.id}`)}>
              <div className="exercise-card-main">
                <div className="exercise-card-head">
                  <h3>{ex.name}</h3>
                  <button
                    className="icon-btn"
                    aria-label="Edit exercise"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/physio/exercise/${ex.id}/edit`);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                </div>
                <div className="exercise-meta">
                  {ex.sets != null && ex.reps && (
                    <span>{ex.sets} × {ex.reps}</span>
                  )}
                  {ex.sets != null && !ex.reps && <span>{ex.sets} sets</span>}
                  {ex.sets == null && ex.reps && <span>{ex.reps}</span>}
                  {ex.frequency && <span className="dot">{ex.frequency}</span>}
                </div>
                <MuscleChips tags={ex.muscleGroups} small />
              </div>
              <button
                className={`done-btn ${done ? 'done' : ''}`}
                aria-label={done ? 'Completed today (tap to undo)' : 'Mark done today'}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompletion(ex.id, today);
                }}
              >
                <Check size={20} />
                <span>{done ? 'Done' : 'Done?'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
