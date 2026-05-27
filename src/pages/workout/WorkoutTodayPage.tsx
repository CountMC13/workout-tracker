import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays } from 'lucide-react';
import { db } from '../../db';
import { todayKey, formatLong } from '../../lib/dates';
import SessionView from '../../components/SessionView';

// Defaults to today, but a date picker lets you log (or review) any other day.
// SessionView + getOrCreateSession are date-agnostic, so the rest just works.
export default function WorkoutTodayPage() {
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const isToday = selectedDate === todayKey();
  const session = useLiveQuery(
    () => db.sessions.where('date').equals(selectedDate).first(),
    [selectedDate],
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1>{isToday ? 'Today' : 'Workout'}</h1>
      </header>

      <div className="row-between" style={{ marginBottom: 6, gap: 8 }}>
        <label className="field" style={{ flex: 1, margin: 0 }}>
          <span className="sr-only">Workout date</span>
          <div className="date-field">
            <CalendarDays size={16} />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || todayKey())}
              aria-label="Workout date"
            />
          </div>
        </label>
        {!isToday && (
          <button className="btn-secondary" onClick={() => setSelectedDate(todayKey())}>
            Today
          </button>
        )}
      </div>

      <p className="home-greeting">{formatLong(selectedDate)}</p>
      <SessionView date={selectedDate} sessionId={session?.id ?? null} />
    </div>
  );
}
