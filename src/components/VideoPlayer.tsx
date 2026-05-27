import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, Pause, RotateCcw, Video } from 'lucide-react';
import { db } from '../db';
import { useObjectUrl } from '../hooks/useObjectUrl';

function fmtTime(s: number): string {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function VideoPlayer({ videoId }: { videoId: string | null }) {
  const video = useLiveQuery(() => (videoId ? db.videos.get(videoId) : undefined), [videoId]);
  const url = useObjectUrl(video?.blob);
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Reset transient UI state when the source changes.
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [url]);

  if (!videoId || !video) {
    return (
      <div className="video-empty">
        <Video size={28} />
        <span>No video attached</span>
      </div>
    );
  }

  const el = () => ref.current;
  const togglePlay = () => {
    const v = el();
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };
  const rewind = () => {
    const v = el();
    if (v) v.currentTime = Math.max(0, v.currentTime - 10);
  };
  const seek = (t: number) => {
    const v = el();
    if (v) v.currentTime = t;
  };

  return (
    <div className="video-player">
      <video
        ref={ref}
        src={url ?? undefined}
        playsInline
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setPlaying(false)}
      />
      <input
        className="seek"
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek video"
      />
      <div className="video-controls">
        <button className="vbtn" onClick={rewind} aria-label="Rewind 10 seconds">
          <RotateCcw size={20} />
          <span className="vbtn-badge">10</span>
        </button>
        <button className="vbtn vbtn-primary" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause size={26} /> : <Play size={26} />}
        </button>
        <span className="video-time">
          {fmtTime(current)} / {fmtTime(duration)}
        </span>
      </div>
    </div>
  );
}
