import { formatShort } from '../lib/dates';
import { round1 } from '../lib/bmi';

export interface TrendPoint {
  x: string; // label/date string, ascending
  y: number;
}

// Dependency-free inline SVG line chart — generalised from WeightChart so the 1RM
// and running screens share one lightweight chart. Reuses the same CSS classes
// (.chart/.lbl/.axis/.goal/.line/.pt) so styling is inherited from index.css.
export default function TrendChart({
  points,
  goal,
  height = 180,
  formatY = round1,
  formatX = formatShort,
  ariaLabel = 'Trend',
  emptyHint = 'Log at least two entries to see a trend.',
}: {
  points: TrendPoint[];
  goal?: number | null;
  height?: number;
  formatY?: (v: number) => string | number;
  formatX?: (x: string) => string;
  ariaLabel?: string;
  emptyHint?: string;
}) {
  if (points.length < 2) {
    return <p className="muted center">{emptyHint}</p>;
  }

  const W = 320;
  const H = height;
  const padL = 30;
  const padR = 10;
  const padT = 12;
  const padB = 22;

  const ys = points.map((p) => p.y);
  let min = Math.min(...ys);
  let max = Math.max(...ys);
  if (goal != null) {
    min = Math.min(min, goal);
    max = Math.max(max, goal);
  }
  if (max - min < 1) {
    min -= 1;
    max += 1;
  }
  const pad = (max - min) * 0.1;
  min -= pad;
  max += pad;

  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const poly = points.map((p, i) => `${x(i)},${y(p.y)}`).join(' ');

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
      {/* y-axis labels */}
      <text className="lbl" x={2} y={y(max) + 4}>{formatY(max)}</text>
      <text className="lbl" x={2} y={y(min) + 4}>{formatY(min)}</text>
      <line className="axis" x1={padL} y1={padT} x2={padL} y2={H - padB} />
      <line className="axis" x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} />

      {goal != null && (
        <line className="goal" x1={padL} y1={y(goal)} x2={W - padR} y2={y(goal)} />
      )}

      <polyline className="line" points={poly} />
      {points.map((p, i) => (
        <circle key={i} className="pt" cx={x(i)} cy={y(p.y)} r={2.5} />
      ))}

      {/* x-axis end labels */}
      <text className="lbl" x={padL} y={H - 6}>{formatX(points[0].x)}</text>
      <text className="lbl" x={W - padR} y={H - 6} textAnchor="end">
        {formatX(points[points.length - 1].x)}
      </text>
    </svg>
  );
}
