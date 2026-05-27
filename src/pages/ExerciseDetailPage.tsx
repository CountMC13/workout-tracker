import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Pencil, Check } from 'lucide-react';
import { db, toggleCompletion } from '../db';
import { todayKey, formatLong } from '../lib/dates';
import VideoPlayer from '../components/VideoPlayer';
import { MuscleChips } from '../components/MuscleChips';

export default function ExerciseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [logDate, setLogDate] = useState(todayKey());

  // null = confirmed not found, undefined = still loading
  const exercise = useLiveQuery(
    async () => (id ? (await db.exercises.get(id)) ?? null : null),
    [id],
  );
  const completions = useLiveQuery(
    () =>
      id
        ? db.completions.where('exerciseId').equals(id).reverse().sortBy('date')
        : [],
    [id],
  );

  if (exercise === undefined) return <div className="page"><p className="muted center">Loading…</p></div>;
  if (exercise === null) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="icon-btn" onClick={() => navigate('/physio')} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1>Not found</h1>
        </header>
        <p className="muted center">This exercise no longer exists.</p>
      </div>
    );
  }

  const completedDates = new Set((completions ?? []).map((c) => c.date));
  const isLogged = completedDates.has(logDate);

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate('/physio')} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="truncate">{exercise.name}</h1>
        <button
          className="icon-btn"
          onClick={() => navigate(`/physio/exercise/${exercise.id}/edit`)}
          aria-label="Edit"
        >
          <Pencil size={18} />
        </button>
      </header>

      <VideoPlayer videoId={exercise.videoId} />

      <div className="detail-stats">
        {exercise.sets != null && (
          <div className="stat">
            <span className="stat-value">{exercise.sets}</span>
            <span className="stat-label">Sets</span>
          </div>
        )}
        {exercise.reps && (
          <div className="stat">
            <span className="stat-value">{exercise.reps}</span>
            <span className="stat-label">Reps</span>
          </div>
        )}
        {exercise.frequency && (
          <div className="stat">
            <span className="stat-value">{exercise.frequency}</span>
            <span className="stat-label">Frequency</span>
          </div>
        )}
      </div>

      <MuscleChips tags={exercise.muscleGroups} />

      {exercise.keyPoints && (
        <section className="detail-section">
          <h2>Key points</h2>
          <p className="prewrap">{exercise.keyPoints}</p>
        </section>
      )}

      {exercise.notes && (
        <section className="detail-section">
          <h2>Notes</h2>
          <p className="prewrap">{exercise.notes}</p>
        </section>
      )}

      <section className="detail-section">
        <h2>Log completion</h2>
        <div className="log-row">
          <input
            type="date"
            value={logDate}
            max={todayKey()}
            onChange={(e) => setLogDate(e.target.value)}
          />
          <button
            className={`btn-primary ${isLogged ? 'logged' : ''}`}
            onClick={() => toggleCompletion(exercise.id, logDate)}
          >
            <Check size={18} />
            {isLogged ? 'Completed — undo' : 'Mark complete'}
          </button>
        </div>
      </section>

      <section className="detail-section">
        <h2>History {completions && completions.length > 0 && `(${completions.length})`}</h2>
        {completions && completions.length > 0 ? (
          <ul className="history-list">
            {completions.map((c) => (
              <li key={c.id}>
                <Check size={16} className="history-check" />
                {formatLong(c.date)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Not completed yet.</p>
        )}
      </section>
    </div>
  );
}
