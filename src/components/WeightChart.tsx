import { formatShort } from '../lib/dates';
import { round1 } from '../lib/bmi';

interface Point {
  date: string;
  weightKg: number;
}

// Dependency-free inline SVG line chart — keeps the offline PWA light.
export default function WeightChart({
  entries,
  goalKg,
  height = 180,
}: {
  entries: Point[]; // ascending by date
  goalKg?: number | null;
  height?: number;
}) {
  if (entries.length < 2) {
    return <p className="muted center">Log at least two weigh-ins to see a trend.</p>;
  }

  const W = 320;
  const H = height;
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 22;

  const weights = entries.map((e) => e.weightKg);
  let min = Math.min(...weights);
  let max = Math.max(...weights);
  if (goalKg != null) {
    min = Math.min(min, goalKg);
    max = Math.max(max, goalKg);
  }
  if (max - min < 1) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  min -= pad;
  max += pad;

  const x = (i: number) => padL + (i / (entries.length - 1)) * (W - padL - padR);
  const y = (w: number) => padT + (1 - (w - min) / (max - min)) * (H - padT - padB);

  const points = entries.map((e, i) => `${x(i)},${y(e.weightKg)}`).join(' ');

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Weight trend">
      {/* y-axis labels */}
      <text className="lbl" x={2} y={y(max) + 4}>{round1(max)}</text>
      <text className="lbl" x={2} y={y(min) + 4}>{round1(min)}</text>
      <line className="axis" x1={padL} y1={padT} x2={padL} y2={H - padB} />
      <line className="axis" x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} />

      {goalKg != null && (
        <line className="goal" x1={padL} y1={y(goalKg)} x2={W - padR} y2={y(goalKg)} />
      )}

      <polyline className="line" points={points} />
      {entries.map((e, i) => (
        <circle key={e.date} className="pt" cx={x(i)} cy={y(e.weightKg)} r={2.5} />
      ))}

      {/* x-axis end labels */}
      <text className="lbl" x={padL} y={H - 6}>{formatShort(entries[0].date)}</text>
      <text className="lbl" x={W - padR} y={H - 6} textAnchor="end">
        {formatShort(entries[entries.length - 1].date)}
      </text>
    </svg>
  );
}
