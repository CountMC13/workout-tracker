import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import SectionSwitcher from './components/SectionSwitcher';
import BottomNav from './components/BottomNav';
import ErrorBoundary from './components/ErrorBoundary';
// Physio (existing)
import ExercisesPage from './pages/ExercisesPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import ExerciseEditPage from './pages/ExerciseEditPage';
import CalendarPage from './pages/CalendarPage';
// Home / settings / body
import HomePage from './pages/HomePage';
import BodyPage from './pages/BodyPage';
import SettingsPage from './pages/SettingsPage';
// Workout
import WorkoutTodayPage from './pages/workout/WorkoutTodayPage';
import SessionPage from './pages/workout/SessionPage';
import WorkoutHistoryPage from './pages/workout/WorkoutHistoryPage';
import WodCatalogPage from './pages/workout/WodCatalogPage';
import WodDetailPage from './pages/workout/WodDetailPage';
import PrBoardPage from './pages/workout/PrBoardPage';
import LiftDetailPage from './pages/workout/LiftDetailPage';
// Run (own top-level section)
import RunPage from './pages/workout/RunPage';
import RunDetailPage from './pages/workout/RunDetailPage';

export type Section = 'home' | 'physio' | 'workout' | 'run' | 'settings';

function sectionFor(path: string): Section {
  if (path.startsWith('/run')) return 'run';
  if (path.startsWith('/workout')) return 'workout';
  if (path.startsWith('/physio') || path.startsWith('/exercise') || path.startsWith('/calendar'))
    return 'physio';
  if (path.startsWith('/settings')) return 'settings';
  return 'home';
}

// Preserve the id when redirecting old physio deep-links.
function LegacyExerciseRedirect() {
  const { id } = useParams();
  return <Navigate to={`/physio/exercise/${id}`} replace />;
}

// Preserve the id when redirecting old /workout/run deep-links to the new section.
function LegacyRunRedirect() {
  const { id } = useParams();
  return <Navigate to={`/run/${id}`} replace />;
}

export default function App() {
  const { pathname } = useLocation();
  const section = sectionFor(pathname);
  const theme = section === 'workout' || section === 'run' ? 'dark' : 'light';
  const showNav = section === 'physio' || section === 'workout' || section === 'run';

  return (
    <div className="app" data-section={section} data-theme={theme}>
      <SectionSwitcher section={section} />
      <main className="app-main">
        <ErrorBoundary key={pathname}>
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* Physio */}
          <Route path="/physio" element={<ExercisesPage />} />
          <Route path="/physio/exercise/new" element={<ExerciseEditPage />} />
          <Route path="/physio/exercise/:id" element={<ExerciseDetailPage />} />
          <Route path="/physio/exercise/:id/edit" element={<ExerciseEditPage />} />
          <Route path="/physio/calendar" element={<CalendarPage />} />

          {/* Legacy redirects so old installs / bookmarks keep working */}
          <Route path="/exercise/new" element={<Navigate to="/physio/exercise/new" replace />} />
          <Route path="/exercise/:id" element={<LegacyExerciseRedirect />} />
          <Route path="/calendar" element={<Navigate to="/physio/calendar" replace />} />

          {/* Workout */}
          <Route path="/workout" element={<WorkoutTodayPage />} />
          <Route path="/workout/session/:id" element={<SessionPage />} />
          <Route path="/workout/history" element={<WorkoutHistoryPage />} />
          <Route path="/workout/wods" element={<WodCatalogPage />} />
          <Route path="/workout/wods/:id" element={<WodDetailPage />} />
          <Route path="/workout/prs" element={<PrBoardPage />} />
          <Route path="/workout/prs/lift/:liftId" element={<LiftDetailPage />} />
          <Route path="/workout/body" element={<BodyPage />} />

          {/* Run (own section) */}
          <Route path="/run" element={<RunPage />} />
          <Route path="/run/:id" element={<RunDetailPage />} />
          {/* Legacy redirects from when Run lived under /workout */}
          <Route path="/workout/run" element={<Navigate to="/run" replace />} />
          <Route path="/workout/run/:id" element={<LegacyRunRedirect />} />

          {/* Settings */}
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </ErrorBoundary>
      </main>
      {showNav && <BottomNav section={section} />}
    </div>
  );
}
