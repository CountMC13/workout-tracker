import { NavLink } from 'react-router-dom';
import {
  Dumbbell,
  CalendarDays,
  ClipboardList,
  Flame,
  Trophy,
  Scale,
  Footprints,
  type LucideIcon,
} from 'lucide-react';
import type { Section } from '../App';

interface Tab {
  to: string;
  label: string;
  Icon: LucideIcon;
  end?: boolean;
}

const PHYSIO_TABS: Tab[] = [
  { to: '/physio', label: 'Exercises', Icon: Dumbbell, end: true },
  { to: '/physio/calendar', label: 'Calendar', Icon: CalendarDays },
];

const WORKOUT_TABS: Tab[] = [
  { to: '/workout', label: 'Today', Icon: ClipboardList, end: true },
  { to: '/workout/history', label: 'History', Icon: CalendarDays },
  { to: '/workout/wods', label: 'WODs', Icon: Flame },
  { to: '/workout/prs', label: 'PRs', Icon: Trophy },
  { to: '/workout/body', label: 'Body', Icon: Scale },
];

const RUN_TABS: Tab[] = [
  { to: '/run', label: 'Running', Icon: Footprints, end: true },
];

export default function BottomNav({ section }: { section: Section }) {
  const tabs = section === 'run' ? RUN_TABS : section === 'workout' ? WORKOUT_TABS : PHYSIO_TABS;
  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="nav-item">
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
