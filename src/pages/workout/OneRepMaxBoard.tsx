import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2, ArrowUp, ArrowDown, Settings2, ChevronRight } from 'lucide-react';
import {
  db,
  addTrackedLift,
  removeTrackedLift,
  reorderTrackedLifts,
  ensureMovement,
} from '../../db';
import { oneRepMaxBests } from '../../lib/oneRepMax';
import { round1 } from '../../lib/bmi';
import { formatShort } from '../../lib/dates';
import { useToast } from '../../hooks/useToast';
import { MAX_TRACKED_LIFTS } from '../../constants';
import type { TrackedLift } from '../../types';

// The "1RM" tab of the PR board: a clean list of tracked lifts, each showing its
// current best 1RM and the date achieved. Tapping a lift opens its detail page
// (entries + chart + % calculator). Manage mode adds / removes / reorders lifts.
export default function OneRepMaxBoard() {
  const { show, node } = useToast();
  const navigate = useNavigate();
  const lifts = useLiveQuery(() => db.trackedLifts.orderBy('order').toArray(), []);
  const bests = useLiveQuery(() => oneRepMaxBests(), []);

  const [manage, setManage] = useState(false);
  const [newName, setNewName] = useState('');

  const orderedIds = useMemo(() => (lifts ?? []).map((l) => l.id), [lifts]);

  const move = (index: number, dir: -1 | 1) => {
    const ids = [...orderedIds];
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void reorderTrackedLifts(ids);
  };

  const remove = (lift: TrackedLift) => {
    if (window.confirm(`Remove "${lift.name}" and its 1RM history?`)) {
      void removeTrackedLift(lift.id);
    }
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    await ensureMovement(name); // link the lift name into the movements library too
    const id = await addTrackedLift(name);
    if (id) setNewName('');
    else show(`Max ${MAX_TRACKED_LIFTS} lifts.`);
  };

  const atCap = (lifts?.length ?? 0) >= MAX_TRACKED_LIFTS;

  return (
    <>
      <div className="row-between" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Tap a lift to view its history, log a 1RM, and see working-set %.
        </p>
        <button
          className={`icon-btn ${manage ? 'active' : ''}`}
          aria-label={manage ? 'Done managing lifts' : 'Manage lifts'}
          aria-pressed={manage}
          onClick={() => setManage((m) => !m)}
        >
          <Settings2 size={20} />
        </button>
      </div>

      {(!lifts || lifts.length === 0) && (
        <div className="empty-state">
          <h2>No lifts tracked</h2>
          <p>Turn on manage mode to add a lift and start tracking its 1RM.</p>
        </div>
      )}

      {lifts?.map((lift, i) => {
        const best = bests?.get(lift.id);
        if (manage) {
          return (
            <div key={lift.id} className="card" style={{ marginTop: 12 }}>
              <div className="row-between">
                <div className="pr-name">{lift.name}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={18} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label="Move down"
                    disabled={i === lifts.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown size={18} />
                  </button>
                  <button className="icon-btn danger" aria-label={`Remove ${lift.name}`} onClick={() => remove(lift)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          );
        }
        return (
          <button
            key={lift.id}
            className="card orm-row"
            style={{ marginTop: 12 }}
            onClick={() => navigate(`/workout/prs/lift/${lift.id}`)}
          >
            <div className="pr-name">{lift.name}</div>
            <div className="orm-row-right">
              {best ? (
                <>
                  <div className="pr-value">{round1(best.best1RM)} kg</div>
                  <div className="pr-sub">
                    {best.bestEstimated && 'est. · '}
                    {formatShort(best.bestDate)}
                  </div>
                </>
              ) : (
                <div className="pr-sub">No 1RM logged</div>
              )}
            </div>
            <ChevronRight size={20} className="orm-row-chevron" />
          </button>
        );
      })}

      {manage && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="section-title" style={{ marginTop: 0 }}>Add lift</div>
          {atCap ? (
            <p className="muted center" style={{ margin: 0 }}>Max {MAX_TRACKED_LIFTS} lifts.</p>
          ) : (
            <div className="field-row">
              <input
                type="text"
                placeholder="e.g. Clean & Jerk"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void add();
                }}
                aria-label="New lift name"
              />
              <button className="btn-secondary" onClick={() => void add()} disabled={!newName.trim()}>
                <Plus size={16} /> Add
              </button>
            </div>
          )}
        </div>
      )}

      {node}
    </>
  );
}
