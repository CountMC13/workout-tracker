import { Link } from 'react-router-dom';
import { Home, HeartPulse, Dumbbell, Footprints, Settings } from 'lucide-react';
import type { Section } from '../App';

const ITEMS: { key: Section; to: string; label: string; Icon: typeof Home }[] = [
  { key: 'home', to: '/', label: 'Home', Icon: Home },
  { key: 'physio', to: '/physio', label: 'Physio', Icon: HeartPulse },
  { key: 'workout', to: '/workout', label: 'Workout', Icon: Dumbbell },
  { key: 'run', to: '/run', label: 'Run', Icon: Footprints },
];

export default function SectionSwitcher({ section }: { section: Section }) {
  return (
    <header className="section-switcher">
      <div className="seg" role="tablist" aria-label="App sections">
        {ITEMS.map(({ key, to, label, Icon }) => (
          <Link
            key={key}
            to={to}
            className={`seg-item ${section === key ? 'active' : ''}`}
            role="tab"
            aria-selected={section === key}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
      <Link
        to="/settings"
        className={`seg-gear ${section === 'settings' ? 'active' : ''}`}
        aria-label="Settings"
      >
        <Settings size={18} />
      </Link>
    </header>
  );
}
