import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Trophy } from 'lucide-react';
import { strengthBests, wodBests, estimate1RM, formatWodScore } from '../../lib/prs';
import { round1 } from '../../lib/bmi';
import { formatShort } from '../../lib/dates';
import OneRepMaxBoard from './OneRepMaxBoard';

type Tab = 'onerm' | 'lifts' | 'wods';

export default function PrBoardPage() {
  const [tab, setTab] = useState<Tab>('onerm');
  const lifts = useLiveQuery(() => strengthBests(), []);
  const wods = useLiveQuery(() => wodBests(), []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>Personal Records</h1>
      </header>

      <div className="toggle2" style={{ marginBottom: 16 }}>
        <button className={tab === 'onerm' ? 'active' : ''} onClick={() => setTab('onerm')}>1RM</button>
        <button className={tab === 'lifts' ? 'active' : ''} onClick={() => setTab('lifts')}>Lifts</button>
        <button className={tab === 'wods' ? 'active' : ''} onClick={() => setTab('wods')}>WODs</button>
      </div>

      {tab === 'onerm' && <OneRepMaxBoard />}

      {tab === 'lifts' && (
        <>
          {!lifts || lifts.length === 0 ? (
            <div className="empty-state">
              <Trophy size={40} />
              <h2>No lift PRs yet</h2>
              <p>Log a strength session with weights to start tracking your bests.</p>
            </div>
          ) : (
            lifts.map((l) => (
              <div key={l.movementId} className="pr-row">
                <div className="pr-name">
                  {l.movementName}
                  {l.date && <div className="pr-sub">{formatShort(l.date)}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="pr-value">
                    {round1(l.topWeightKg)} kg<span className="muted" style={{ fontWeight: 400 }}> × {l.topReps}</span>
                  </div>
                  <div className="pr-sub">est. 1RM {round1(estimate1RM(l.topWeightKg, l.topReps))} kg</div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {tab === 'wods' && (
        <>
          {!wods || wods.length === 0 ? (
            <div className="empty-state">
              <Trophy size={40} />
              <h2>No WOD PRs yet</h2>
              <p>Log a benchmark result to see your bests here.</p>
            </div>
          ) : (
            wods.map((w) => (
              <div key={`${w.wodId}-${w.rxStatus}`} className="pr-row">
                <div className="pr-name">
                  {w.wodName}
                  <div className="pr-sub">
                    {w.rxStatus === 'rx' ? 'Rx' : 'Scaled'} · {formatShort(w.result.date)}
                  </div>
                </div>
                <div className="pr-value">{formatWodScore(w.result)}</div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
