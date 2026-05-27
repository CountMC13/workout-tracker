import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Database, ChevronRight } from 'lucide-react';
import { db, seedWods, seedMovements, createWod } from '../../db';
import { SCORE_TYPE_LABELS } from '../../constants';
import type { WodScoreType } from '../../types';

const CLASS_LABELS: Record<string, string> = {
  benchmark: 'Benchmark',
  hero: 'Hero',
  open: 'Open',
  custom: 'Custom',
};

export default function WodCatalogPage() {
  const navigate = useNavigate();
  const wods = useLiveQuery(() => db.wods.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [scoreType, setScoreType] = useState<WodScoreType>('forTime');
  const [description, setDescription] = useState('');

  const filtered = useMemo(() => {
    const list = wods ?? [];
    if (!q.trim()) return list;
    const t = q.trim().toLowerCase();
    return list.filter((w) => w.name.toLowerCase().includes(t) || w.keyComponent.toLowerCase().includes(t));
  }, [wods, q]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const w of filtered) (groups[w.classification] ??= []).push(w);
    return groups;
  }, [filtered]);

  const onSeed = async () => {
    await seedWods();
    await seedMovements();
  };

  const onCreate = async () => {
    if (!name.trim()) return;
    const id = await createWod({
      name: name.trim(),
      classification: 'custom',
      scoreType,
      keyComponent: '',
      targetText: '',
      description: description.trim(),
    });
    setName('');
    setDescription('');
    setAdding(false);
    navigate(`/workout/wods/${id}`);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>WODs</h1>
        <button className="btn-primary" onClick={() => setAdding((a) => !a)}>
          <Plus size={18} /> New
        </button>
      </header>

      {adding && (
        <div className="card stack" style={{ marginBottom: 14 }}>
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My WOD" autoFocus />
          </label>
          <label className="field">
            <span>Scored by</span>
            <select value={scoreType} onChange={(e) => setScoreType(e.target.value as WodScoreType)}>
              {Object.entries(SCORE_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Rep scheme / movements" />
          </label>
          <button className="btn-primary full" onClick={onCreate}>Create WOD</button>
        </div>
      )}

      {wods && wods.length === 0 && !adding && (
        <div className="empty-state">
          <Database size={40} />
          <h2>No WODs yet</h2>
          <p>Load the starter library (Fran, Cindy, Grace, Murph, DT and more) or add your own.</p>
          <button className="btn-primary" onClick={onSeed}>
            <Database size={18} /> Load library
          </button>
        </div>
      )}

      {wods && wods.length > 0 && (
        <input
          placeholder="Search WODs…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 14 }}
        />
      )}

      {Object.entries(grouped).map(([cls, list]) => (
        <div key={cls}>
          <h2 className="section-title">{CLASS_LABELS[cls] ?? cls}</h2>
          <ul className="exercise-list">
            {list.map((w) => (
              <li key={w.id} className="exercise-card wod-card" onClick={() => navigate(`/workout/wods/${w.id}`)}>
                <div className="exercise-card-main">
                  <div className="wod-name">{w.name}</div>
                  <div className="exercise-meta">
                    <span>{SCORE_TYPE_LABELS[w.scoreType]}</span>
                    {w.keyComponent && <span className="dot">{w.keyComponent}</span>}
                    {w.targetText && <span className="dot">{w.targetText}</span>}
                  </div>
                </div>
                <ChevronRight size={18} className="muted" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
