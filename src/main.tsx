import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { seedMovements, seedWods, seedTrackedLifts } from './db';
import { ensurePersistence } from './lib/storageStatus';
import './index.css';

// Self-heal stale caches: when an updated service worker takes control, reload
// once so the page lands on the matching (fresh) assets instead of a half-stale
// precached shell. The `reloaded` guard prevents a reload loop.
if ('serviceWorker' in navigator) {
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

// Ask the browser to keep our IndexedDB data (reduces silent eviction).
// The granted/denied state is surfaced to the user in Settings → Storage.
ensurePersistence().catch(() => {});
// Seed the workout libraries on first launch (idempotent — no-ops once populated).
Promise.all([seedMovements(), seedWods(), seedTrackedLifts()]).catch(() => {});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
