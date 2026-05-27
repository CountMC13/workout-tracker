import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Play, Square, Trash2, Trophy } from 'lucide-react';
import { db, logWodResult, deleteWodResult, deleteWod } from '../../db';
import { SCORE_TYPE_LABELS } from '../../constants';
import { todayKey, formatShort } from '../../lib/dates';
import { detectWodPR, formatWodScore, wodResultValue, isLowerBetter } from '../../lib/prs';
import { useToast } from '../../hooks/useToast';
import { useWakeLock } from '../../hooks/useWakeLock';
import type { RxStatus, WodResult } from '../../types';

export default function WodDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { show, node } = useToast();

  const wod = useLiveQuery(async () => (id ? (await db.wods.get(id)) ?? null : null), [id]);
  const results = useLiveQuery(
    () => (id ? db.wodResults.where('wodId').equals(id).toArray() : []),
    [id],
  );

  const [rx, setRx] = useState<RxStatus>('rx');
  const [date, setDate] = useState(todayKey());
  const [mins, setMins] = useState(0);
  const [secs, setSecs] = useState(0);
  const [capped, setCapped] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [extraReps, setExtraReps] = useState(0);
  const [score, setScore] = useState(0);
  const [notes, setNotes] = useState('');

  // Stopwatch (for-time)
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const wakeLock = useWakeLock();

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now() - elapsed * 1000;
    const iv = window.setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const startTimer = async () => {
    setRunning(true);
    await wakeLock.acquire();
  };
  const stopTimer = () => {
    setRunning(false);
    wakeLock.release();
    setMins(Math.floor(elapsed / 60));
    setSecs(elapsed % 60);
  };

  if (wod === undefined) return <div className="page"><p className="muted center">Loading…</p></div>;
  if (wod === null) {
    return (
      <div className="page">
        <header className="page-header">
          <button className="icon-btn" onClick={() => navigate('/workout/wods')} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1>Not found</h1>
        </header>
      </div>
    );
  }

  const sorted = [...(results ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const bestValue = (rxStatus: RxStatus): number | null => {
    let best: number | null = null;
    const lower = isLowerBetter(wod.scoreType);
    for (const r of results ?? []) {
      if (r.rxStatus !== rxStatus) continue;
      const v = wodResultValue(r);
      if (v == null) continue;
      if (best == null || (lower ? v < best : v > best)) best = v;
    }
    return best;
  };

  const save = async () => {
    const input = {
      wodId: wod.id,
      wodName: wod.name,
      date,
      scoreType: wod.scoreType,
      rxStatus: rx,
      durationSec: wod.scoreType === 'forTime' ? mins * 60 + secs : null,
      rounds: wod.scoreType === 'amrap' ? rounds : null,
      extraReps: wod.scoreType === 'amrap' ? extraReps : null,
      score: wod.scoreType === 'load' || wod.scoreType === 'reps' ? score : null,
      cappedOut: wod.scoreType === 'forTime' ? capped : false,
      notes,
    };
    const resultId = await logWodResult(input);
    const saved = await db.wodResults.get(resultId);
    if (saved && (await detectWodPR(saved))) show(`PR! ${wod.name}`);
    else show('Result saved');
    setNotes('');
    setElapsed(0);
  };

  const onDeleteWod = async () => {
    if (confirm(`Delete the WOD "${wod.name}" and all its results?`)) {
      await deleteWod(wod.id);
      navigate('/workout/wods');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate('/workout/wods')} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="truncate">{wod.name}</h1>
      </header>

      <div className="card">
        <div className="exercise-meta">
          <span>{SCORE_TYPE_LABELS[wod.scoreType]}</span>
          {wod.targetText && <span className="dot">{wod.targetText}</span>}
        </div>
        {wod.description && <p className="prewrap" style={{ marginTop: 8 }}>{wod.description}</p>}
      </div>

      {/* Log a result */}
      <h2 className="section-title">Log a result</h2>
      <div className="card stack">
        <div className="toggle2">
          <button className={rx === 'rx' ? 'active' : ''} onClick={() => setRx('rx')}>Rx</button>
          <button className={rx === 'scaled' ? 'active' : ''} onClick={() => setRx('scaled')}>Scaled</button>
        </div>

        {wod.scoreType === 'forTime' && (
          <>
            <div className="timer-display">
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </div>
            <button className={running ? 'btn-danger full tap' : 'btn-primary full tap'} onClick={running ? stopTimer : startTimer}>
              {running ? <><Square size={18} /> Stop</> : <><Play size={18} /> Start timer</>}
            </button>
            <div className="field-row">
              <label className="field">
                <span>Minutes</span>
                <input type="number" inputMode="numeric" value={mins || ''} onChange={(e) => setMins(Number(e.target.value))} />
              </label>
              <label className="field">
                <span>Seconds</span>
                <input type="number" inputMode="numeric" value={secs || ''} onChange={(e) => setSecs(Number(e.target.value))} />
              </label>
            </div>
            <label className="row-between">
              <span>Hit the time cap (didn't finish)</span>
              <input type="checkbox" style={{ width: 'auto' }} checked={capped} onChange={(e) => setCapped(e.target.checked)} />
            </label>
          </>
        )}

        {wod.scoreType === 'amrap' && (
          <div className="field-row">
            <label className="field">
              <span>Rounds</span>
              <input type="number" inputMode="numeric" value={rounds || ''} onChange={(e) => setRounds(Number(e.target.value))} />
            </label>
            <label className="field">
              <span>+ Reps</span>
              <input type="number" inputMode="numeric" value={extraReps || ''} onChange={(e) => setExtraReps(Number(e.target.value))} />
            </label>
          </div>
        )}

        {(wod.scoreType === 'load' || wod.scoreType === 'reps') && (
          <label className="field">
            <span>{wod.scoreType === 'load' ? 'Load (kg)' : 'Reps'}</span>
            <input type="number" inputMode="decimal" value={score || ''} onChange={(e) => setScore(Number(e.target.value))} />
          </label>
        )}

        <label className="field">
          <span>Date</span>
          <input type="date" value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Scaling, how it felt…" />
        </label>

        <button className="btn-primary full tap" onClick={save}>Save result</button>
      </div>

      {/* History */}
      <h2 className="section-title">Your results {sorted.length > 0 && `(${sorted.length})`}</h2>
      {sorted.length === 0 ? (
        <p className="muted">No results logged yet.</p>
      ) : (
        <ul className="history-list">
          {sorted.map((r: WodResult) => {
            const v = wodResultValue(r);
            const isBest = v != null && v === bestValue(r.rxStatus);
            return (
              <li key={r.id}>
                <span style={{ flex: 1 }}>
                  {formatShort(r.date)} <span className="muted">· {r.rxStatus === 'rx' ? 'Rx' : 'Scaled'}</span>
                </span>
                {isBest && <Trophy size={14} style={{ color: '#f59e0b' }} />}
                <span style={{ fontWeight: 700 }}>{formatWodScore(r)}</span>
                <button className="icon-btn danger" aria-label="Delete result" onClick={() => deleteWodResult(r.id)}>
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {wod.classification === 'custom' && (
        <button className="btn-danger full" style={{ marginTop: 24 }} onClick={onDeleteWod}>
          <Trash2 size={18} /> Delete WOD
        </button>
      )}

      {node}
    </div>
  );
}
