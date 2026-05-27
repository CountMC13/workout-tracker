# Fitness Tracker

A personal, **offline** fitness tracker that runs as a PWA (installable web app) on **Windows desktop** and **Android**. No accounts, no cloud — all data lives in the device's local database (IndexedDB). It has three clearly-separated areas, reachable from the top **Home · Physio · Workout** switcher:

Built with React + Vite + Dexie (IndexedDB) + vite-plugin-pwa.

## Features

**Physio** (teal)
- **Video management** — import MP4s; play / pause / −10s rewind with a seek bar. Videos are stored locally inside the app.
- **Exercise config** — name, sets, reps, frequency, key points, notes, and one-or-more muscle-group tags (presets + custom).
- **Tracking** — one-tap "Done today" on the list, or log/undo completion for any date on the detail screen.
- **Calendar** — month view with completion markers, tap any day to see what was done, filter history by exercise and/or muscle group.

**Workout** (amber, dark theme for the gym)
- **Strength logging** — pick a movement (searchable library), log per-set reps × weight, tap how it "felt", "Copy last" to clone a prior session.
- **WODs** — a seeded catalog (Fran, Cindy, Grace, Murph, DT + more); log For Time (with a built-in stopwatch + screen wake-lock) or AMRAP results, Rx/Scaled, and add your own custom WODs.
- **Personal records** — automatic best-lift (with estimated 1RM) and best-WOD detection, with a 🏆 "PR!" toast when you beat one.
- **History** — calendar + recent-sessions list.

**Body**
- **Weight + BMI** — log your weight, see BMI with WHO category bands (and an honest athlete caveat), a weight-trend chart, and progress toward a goal weight. Set your height in **Settings**.

**Home** — at-a-glance "done today?" status, weekly consistency strips + streaks, weight trend, and a PR shortcut.

**Data** (Settings) — one-tap **Export all data** to a `.zip` backup (records + videos) and **Restore**. Everything stays on the device; export regularly.

## Quick launch (Windows)

Double-click **Physio Tracker** on your Desktop. The launcher (`launch.cmd`) builds the app if needed, starts a local server, and opens it in your browser at `http://localhost:4173/` — no terminal required. Keep the small launcher window open while using the app; close it to stop the server.

> Note: the launcher serves the last build. If you change the source code, run `npm run build` (or delete the `dist/` folder) so the next launch picks up your changes.

## Run it (dev)

```powershell
npm install      # once
npm run dev      # dev server at http://localhost:5173
```

For a production build (also generates the offline service worker + icons):

```powershell
npm run icons    # regenerate app icons (only needed if you change the icon script)
npm run build    # outputs to dist/
npm run preview  # serve the built app, add --host to expose on your LAN
```

## Install as an app

**Windows:** open the app in Edge or Chrome → address-bar **Install** icon (or ⋮ menu → *Install Physio Tracker*). It then opens in its own window and works offline.

**Android:** a service worker requires HTTPS (or `localhost`), so to install on a phone, host the `dist/` folder on any static host once (e.g. Netlify/Vercel/GitHub Pages). Open it in Chrome → ⋮ → *Add to Home screen*. After install the app runs **fully offline** and your data never leaves the phone — the host only delivers the initial files.

## Sample videos

The `Videos/` folder already contains 9 example physio clips. After adding an exercise, use **Import MP4 video** in the editor and pick one of them.

## Data & storage

- Everything is stored in IndexedDB on the device (`PhysioTrackerDB`): `exercises`, `videos` (MP4 blobs), `completions`.
- No network requests are made at runtime. Clearing the browser/app storage erases the data, so keep your original MP4 files as backups.
