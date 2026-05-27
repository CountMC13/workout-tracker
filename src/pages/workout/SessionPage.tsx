import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft } from 'lucide-react';
import { db } from '../../db';
import { formatLong } from '../../lib/dates';
import SessionView from '../../components/SessionView';

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = useLiveQuery(
    async () => (id ? (await db.sessions.get(id)) ?? null : null),
    [id],
  );

  if (session === undefined) return <div className="page"><p className="muted center">Loading…</p></div>;
  if (session === null) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="icon-btn" onClick={() => navigate('/workout/history')} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1>Not found</h1>
        </header>
        <p className="muted center">This session no longer exists.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate('/workout/history')} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="truncate">{formatLong(session.date)}</h1>
      </header>
      <SessionView date={session.date} sessionId={session.id} />
    </div>
  );
}
