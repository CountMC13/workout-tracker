import { tagColor } from '../constants';

export function MuscleChip({ tag, small }: { tag: string; small?: boolean }) {
  const color = tagColor(tag);
  return (
    <span
      className={small ? 'chip chip-sm' : 'chip'}
      style={{ background: `${color}1a`, color, borderColor: `${color}55` }}
    >
      {tag}
    </span>
  );
}

export function MuscleChips({ tags, small }: { tags: string[]; small?: boolean }) {
  if (!tags.length) return null;
  return (
    <div className="chips">
      {tags.map((t) => (
        <MuscleChip key={t} tag={t} small={small} />
      ))}
    </div>
  );
}
