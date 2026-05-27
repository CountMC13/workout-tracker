# Workout Tracker v5 — Handover

A personal, **offline** fitness-tracking PWA for **Windows desktop** and **Android**. Four top-level areas:
**Physio** (follow videos, check off exercises), **Workout** (CrossFit strength + WODs + personal records incl. a dedicated **1RM tracker**), **Run** (its own section: log distance/time/RPE + running PRs), and **Body** (weight + BMI). No accounts, no cloud — all data lives in the browser's IndexedDB on the device.

This document is the single source of truth for anyone (human or AI) continuing the work.

> **v5 (this copy)** is a resilience release on top of v4 — **no Dexie schema change**, no feature changes:
> 1. **Global error boundary** (`src/components/ErrorBoundary.tsx`) wraps the routed page area in `App.tsx`, keyed by `pathname`. A render error now shows a readable panel (message + stack, **Copy** + **Reload**) instead of a blank white screen, and switching tabs auto-recovers. Fixes the reported **"Run tab crashes (white screen) on Android"** symptom — a thrown error previously unmounted the whole tree with no message.
> 2. **Service-worker self-heal** (`src/main.tsx`): on `controllerchange` the app reloads once, so an updated SW lands on fresh assets instead of a half-stale precached shell (the likely root cause; also ends the recurring "showing the old version" problem).
> 3. **Date-formatter hardening** (`src/lib/dates.ts`): `formatLong`/`formatShort` wrap `toLocaleDateString` in try/catch with a locale-independent fallback, so an Intl quirk can never throw.
>
> **v4** refined the Workout area on top of v3 — **no Dexie schema change** (still `version(3)`; all v1–v3 data is preserved):
> 1. **1RM tracker reworked.** The "1RM" PR tab is now a **clean list** (lift name + best 1RM + date achieved). Tapping a lift opens a **detail page** (`/workout/prs/lift/:liftId`) with **Entries** and **Graph** tabs: every logged 1RM is individually **editable / deletable** (undo on delete), the trend chart lives on its own tab, and the working-set **% + plate calculator** moved here. New CRUD: `updateOneRepMax`, `restoreOneRepMax` (db.ts).
> 2. **Workout logger** shows the matching tracked-lift **1RM next to a movement's name**, plus a **reference-only % of 1RM calculator** (single % in 2.5% steps or a custom value, **or** a range like 75%–90%) under each movement.
> 3. **Rest timer removed** — the set "tick" no longer starts a timer; `RestTimer.tsx` and the Settings "Rest timer" field are gone (`profile.restSec` left in place, unused, to avoid a migration).
> 4. **Workout tab date selector** — defaults to today but a date picker logs/reviews any day (a "Today" button resets).
> 5. **Run promoted to a top-level section** (`/run`, `/run/:id`) with its own **emerald** dark theme; removed from the Workout bottom-nav. Old `/workout/run*` links redirect.
>
> **v3** added, on top of v2: the 1RM board, the Running activity, and Home dashboard tiles; schema bumped to Dexie `version(3)` additively.

---

## 1. Quick start

**Prerequisite:** Node.js 18+ (ships with npm).

```powershell
cd "app"
npm install        # once
npm run dev        # dev server → http://localhost:5173
```

Production build + local preview:
```powershell
npm run build      # type-checks (tsc) + builds to app/dist + generates the PWA service worker
npm run preview    # serves the built app (add --host to expose on your LAN)
```

**Windows one-click:** double-click `app/launch.cmd` — it builds if needed, starts a local server, and opens the app in your browser. Keep the small window open while using it; close it to stop the server.

On first launch the app auto-seeds the WOD + movement libraries (idempotent). Then open **Settings** to import your physio videos (see §8).

---

## 2. Current status (v4.0.0)

> **v4 on top of v3:** 1RM tracker reworked into a clean board + per-lift detail page (Entries/Graph tabs, per-entry edit/delete); logger shows a movement's 1RM + a reference-only % calculator (steps/custom/range); rest timer removed; Workout-tab date selector; **Run promoted to its own top-level section** with an emerald theme. **No schema change** (still `version(3)`).
>
> **v3 on top of v2:** dedicated **1RM tracker** with manual log + progress chart + % / plate calculator, customisable lift list (6 seeded, max 10); **Running** activity; **Home tiles** for latest run / weekly distance / current 1RMs. Dexie schema → `version(3)`, additive. New libs `oneRepMax.ts` + `runs.ts`, shared `TrendChart.tsx`. Backup/restore extended to the new tables.
>
> **v2 (Fix & polish) on top of v1.1.0:** Workout-tab contrast fixed; non-destructive backup restore; storage/persistence status + backup-age reminder; undo-on-delete and auto-focus set entry; larger tap targets. (v2's rest timer was removed in v4.)

**v4 areas:**

| Area | Status |
|---|---|
| Workout: 1RM board is a clean tappable list (best 1RM + date) → per-lift **detail page** | ✅ Done |
| Workout: 1RM detail — **Entries** tab (per-entry edit/delete + undo), **Graph** tab, % + plates | ✅ Done |
| Workout: logger shows movement **1RM** + reference-only **% calculator** (steps/custom/range) | ✅ Done |
| Workout: **rest timer removed** (set tick no longer starts a timer; Settings field gone) | ✅ Done |
| Workout: **date selector** on Today tab (defaults today, logs any date) | ✅ Done |
| **Run**: own top-level section (`/run`, `/run/:id`), emerald theme, legacy redirects | ✅ Done |


| Area | Status |
|---|---|
| Physio (videos, exercises, completion, calendar) | ✅ Done (pre-existing, now under `/physio/*`) |
| Top-level Home/Physio/Workout/Run navigation + per-section theming | ✅ Done |
| Home dashboard (today status, weekly strips, streaks, weight, PR link) | ✅ Done |
| Workout: strength logging (movements, sets×reps×weight, "felt", copy-last) | ✅ Done |
| Workout: WOD catalog (12 seeded benchmarks) + custom WODs | ✅ Done |
| Workout: WOD logging (For Time + stopwatch + wake-lock, AMRAP, load, reps; Rx/Scaled) | ✅ Done |
| Workout: Personal records (lifts w/ est. 1RM, WOD bests, "PR!" toast) | ✅ Done |
| Workout: History (calendar + recent sessions) | ✅ Done |
| Body: weight log, BMI + WHO bands + athlete caveat, SVG trend chart, goal | ✅ Done |
| Settings: profile (height/goal/sex/birth year) | ✅ Done |
| Backup: export/restore `.zip` (records + video blobs), `storage.persist()` | ✅ Done |
| Seed importers: WOD/movement library, bulk physio-video import | ✅ Done |

**Verification done (v4):** `npm run build` passes (TypeScript strict `tsc -b` + Vite + service worker), 1660 modules, no errors.
**Verification NOT done:** the app has **not been clicked through in a real browser** — the React/Dexie runtime behaviour (editing/deleting individual 1RM entries, the logger 1RM + % calculator, the Workout date selector, the new Run section + theme, dark-theme readability) should be smoke-tested manually. See §9.

---

## 3. Architecture

- **Stack:** React 18 + TypeScript (strict) + Vite 5 + **Dexie** (IndexedDB wrapper) + react-router-dom v6 (`HashRouter`) + `vite-plugin-pwa` (`autoUpdate`). Icons: `lucide-react`. Calendar: `react-calendar`. Backup zip: `jszip`.
- **Single database**, single SPA. `base: './'` (relative) so it works installed, from a sub-path host, or from disk. `HashRouter` so deep links survive PWA reloads.
- **Section model:** the URL prefix decides the section. `App.tsx` sets `data-section` and `data-theme` on the root `.app` element. CSS overrides the accent tokens per section (Workout → amber, Run → emerald) and switches both to a dark theme — so existing components recolour with **no per-component edits**. Sections: `home | physio | workout | run | settings`.
- **Offline:** no network calls at runtime; the service worker precaches the app shell. Videos and all records live in IndexedDB.

### Routing (in `app/src/App.tsx`)
```
#/                         Home dashboard
#/physio                   Exercises (list)        + /physio/exercise/new|:id|:id/edit, /physio/calendar
#/workout                  Today (session logger; date picker defaults to today)
#/workout/session/:id      a specific session
#/workout/history          calendar + recent sessions
#/workout/wods             WOD catalog             + /workout/wods/:id (detail + log results)
#/workout/prs              PR board (1RM list / Lifts / WODs)
#/workout/prs/lift/:liftId 1RM detail (Entries + Graph tabs, % + plates)   [v4]
#/workout/body             weight + BMI
#/run                      Running (own section)   + /run/:id (run detail)   [v4]
#/settings                 profile + data backup + seed importers
# legacy redirects: /exercise/:id → /physio/exercise/:id, /calendar → /physio/calendar,
#                   /workout/run → /run, /workout/run/:id → /run/:id
```

---

## 4. Data model (Dexie `PhysioTrackerDB`)

Schema is **versioned**. v1 (physio) is untouched; v2 added the workout + body tables **additively** (no `.upgrade()` callback, so existing data is never transformed). All definitions live in `app/src/db.ts` and `app/src/types.ts`.

```
// v1 (do NOT edit this block)
exercises        id, name, order, createdAt, *muscleGroups
videos           id, createdAt                      // MP4 blobs stored inline
completions      id, exerciseId, date, [exerciseId+date]

// v2 (additive)
profile          id                                 // singleton row id:'me' (height, units, goal, weeklyRunGoalKm, barWeightKg…)
weights          id, date                           // one weigh-in per day
movements        id, name, category                 // reusable movement library
wods             id, name, classification           // benchmark catalog + custom
sessions         id, date, createdAt                // a training day
strengthEntries  id, sessionId, movementId, [sessionId+order]
wodResults       id, sessionId, wodId, date, [wodId+rxStatus]

// v3 (additive)
trackedLifts     id, order                          // lifts shown on the 1RM board (seeded 6, max 10)
oneRepMaxes      id, liftId, date, [liftId+date]    // manual 1RM log points; comparable value derived (Epley)
runs             id, date, createdAt                // logged runs: distanceKm, durationSec, rpe, runType
```

Key entity shapes (see `types.ts` for the full interfaces):
- **`WeightEntry`** `{ date, weightKg, note }` — BMI is **computed on demand** from `profile.heightCm` (not stored), so a height correction instantly fixes all history.
- **`StrengthEntry`** `{ sessionId, movementId, movementName, order, sets: StrengthSet[], felt }` where `StrengthSet = { reps, weightKg|null, done }`. `movementName` is **denormalized** so history reads even if the library changes.
- **`WodResult`** `{ wodId, wodName, date, scoreType, rxStatus, durationSec|rounds|extraReps|score, cappedOut, notes }`.
- **PRs are derived, not stored** — computed on the fly in `app/src/lib/prs.ts` (the data set is small). PR detection at save time compares a candidate against existing history.

---

## 5. File map (`app/src/`)

```
App.tsx                  routes + section-aware layout shell
main.tsx                 entry; storage.persist() + auto-seed libraries
types.ts                 all entity interfaces
db.ts                    Dexie schema (v1+v2) + ALL CRUD + seed functions
constants.ts             muscle groups, tag colours, session types, felt options, score-type labels
index.css                all styles (CSS custom-property tokens; section accents; dark theme)

lib/
  dates.ts               YYYY-MM-DD date keys, current-week strip, streak length
  bmi.ts                 computeBmi, WHO bmiCategory bands, round1
  prs.ts                 estimate1RM (Epley), strengthBests, wodBests, detect*PR, formatWodScore
  oneRepMax.ts           [v3] oneRepMaxBests/History, percentTable, platesFor; [v4] weightForPercent
  runs.ts                [v3] paceSecPerKm, formatPace/Distance/RunDuration, runningBests, currentWeekDistanceKm
  backup.ts              JSZip export/import of every table + video blobs (incl. v3 tables)

hooks/
  useObjectUrl.ts        blob → object URL (existing)
  useToast.tsx           transient "PR!" / confirmation toast

components/
  SectionSwitcher.tsx    top Home/Physio/Workout/Run switch + settings gear
  BottomNav.tsx          config-driven, section-aware bottom nav (WORKOUT_TABS, RUN_TABS, PHYSIO_TABS)
  VideoPlayer.tsx        physio video player (existing)
  MuscleChips.tsx        coloured tag chips (existing)
  WeightChart.tsx        dependency-free inline SVG line chart
  TrendChart.tsx         [v3] generalised SVG line chart (points/goal/formatters); used by 1RM + running
  SessionView.tsx        the core workout logger; [v4] shows movement 1RM + % calc; rest timer removed
  (RestTimer.tsx removed in v4 — useWakeLock.ts stays, still used by the WOD stopwatch)

pages/
  HomePage.tsx           dashboard
  BodyPage.tsx           weight + BMI
  SettingsPage.tsx       profile + data + importers
  ExercisesPage / ExerciseDetailPage / ExerciseEditPage / CalendarPage   (physio, existing)
  workout/
    WorkoutTodayPage.tsx     resolves today's session → SessionView
    SessionPage.tsx          a specific session → SessionView
    WorkoutHistoryPage.tsx   calendar + recent list
    WodCatalogPage.tsx       catalog + custom-WOD create
    WodDetailPage.tsx        WOD info + log result (timer) + results history
    PrBoardPage.tsx          1RM / Lifts / WODs PR tabs (1RM is the default tab)
    OneRepMaxBoard.tsx       [v4] 1RM tab: clean tappable lift list + manage (add/remove/reorder); rows link to LiftDetailPage
    LiftDetailPage.tsx       [v4] per-lift detail: Entries (edit/delete) + Graph tabs, logger, % + plates
    RunPage.tsx              running: week vs goal, log form (shared RunForm), bests, recent runs (now /run)
    RunDetailPage.tsx        view/edit/delete a single run (now /run/:id; files still live under pages/workout/)

seed/
  library.ts             MOVEMENTS_SEED (30) + WODS_SEED (12 benchmarks incl. Fran/Cindy/Grace/Murph/DT)
```

---

## 6. Conventions (follow these when extending)

- **Dates:** always `YYYY-MM-DD` local keys via `lib/dates.ts` (`todayKey()`, `toDateKey(date)`). This is how "done today" and the calendars stay timezone-correct.
- **Reactive reads:** use `useLiveQuery(() => db.<table>…, [deps])` (from `dexie-react-hooks`). It re-renders on any matching DB change. `prs.ts` helpers are async and read multiple tables — `useLiveQuery(() => strengthBests())` still tracks them.
- **Styling:** everything is driven by CSS custom properties in `index.css` (`--teal`, `--bg`, `--surface`, `--text`, `--border`, `--radius`, `--max-w`, …). To recolour or theme, override tokens — don't hardcode colours in components. Reuse existing classes (`.card`, `.btn-primary`, `.field`, `.chip`, `.exercise-card`, `.history-list`, etc.).
- **Inputs:** keep `font-size: 16px` (avoids Android zoom-on-focus) and use `inputMode="numeric"/"decimal"`. Primary gym buttons use the `.tap` class (≥56px).
- **IDs:** `newId()` in `db.ts` (crypto.randomUUID with fallback).
- **New record types:** include an `updatedAt: number` field (already done for profile/weights/sessions) so optional future sync (last-write-wins) stays possible.

### ⚠️ Gotchas the next developer WILL hit
1. **Dexie migrations:** NEVER edit the `version(1)` block. Add a NEW `version(N)` block declaring only the new/changed tables. Re-declaring an existing table with a different index string rebuilds it. Avoid `.upgrade()` callbacks that touch existing rows unless you really mean to.
2. **Dexie `transaction()` with >5 tables** needs the **array** form: `db.transaction('rw', [t1, t2, …], fn)` — not 6+ positional args (this bit `backup.ts`).
3. **`isolatedModules` is on** → use `import type { … }` for type-only imports.
4. **`noUnusedLocals` / `noUnusedParameters` are on** → no dangling imports/vars or the build fails.
5. **`equalsIgnoreCase` / `.below()` etc. require the field to be indexed** (e.g. `movements.name`, `sessions.date`).

---

## 7. Backup format

`Settings → Export all data` produces `fitness-backup-YYYY-MM-DD.zip`:
- `data.json` — every table's rows + `videos` **metadata** + `schemaVersion`.
- `videos/<id>.mp4` — each video blob, stored **uncompressed** (MP4 is already compressed).

Restore is **Replace mode** (clears all tables, then bulk-inserts) inside one transaction. Uses the File System Access API ("Save As") on desktop Edge/Chrome, falling back to download / `<input type=file>` on Android. To add **Merge** mode later, upsert by `id` instead of clearing (the `updatedAt` fields support last-write-wins).

---

## 8. Source data (in `../source-data/`)

- `Videos/` — the 9 physio MP4s. Import via **Settings → Import physio videos as exercises** (one exercise per file; the filename becomes the name — edit details/tags afterwards). `saveVideo()` stores each blob in IndexedDB.
- `Work out tracker.xlsx` — the user's original tracker. Sheet 1 = strength log (Date/Type/Exercise/Sets/Reps/Weight/Felt); Sheet 2 = WOD catalog (the 5 benchmarks, already seeded). Importing the historical **strength rows** is a not-yet-built nice-to-have (see roadmap).
- `physio_tracker_prd.md` — the original physio PRD.

> Note: this `source-data` folder is a copy bundled for convenience. The app never reads it directly; everything is imported into IndexedDB.

---

## 9. Recommended manual smoke test (do this first)

1. `npm run dev`, open in Chrome/Edge.
2. **Home** loads without console errors; libraries auto-seed.
3. **Settings** → import the 9 videos → they appear under **Physio**; play one; mark "Done today"; check the **Calendar**.
4. **Workout → Today:** confirm it opens on **today**; change the **date picker** to a past date, add a movement + set → it persists under that date in **History**; tap **Today** to reset.
5. Add a movement (e.g. Back Squat), log a set with weight, tap a "felt"; confirm it shows in **History** and **PRs → Lifts**. Log it again heavier → gold **"PR!"** toast. Tapping the set **tick should NOT start a rest timer** (removed).
6. **[v4] Logger 1RM + %:** after logging a 1RM for Back Squat (step 8), re-open it in Today → its **1RM shows next to the name**; tap **% of 1RM** → try a single % (2.5% steps + custom value) and a **range** (e.g. 75–90%) → correct kg / kg-range shown. A movement with no tracked 1RM shows the muted hint.
7. **WODs → Fran:** run the stopwatch, save Rx → appears in **Today** and **PRs → WODs**. **Body:** set height in Settings, log two weights → BMI + chart render.
8. **[v4] Workout → PRs → 1RM:** clean list of 6 seeded lifts (best 1RM + date). **Tap Back Squat** → detail page. **Log 1RM** (weight + date) → shows as best; log a heavier one → **Graph** tab shows the trend. On **Entries** tab: **edit** an entry (change weight/reps/date → best & graph update) and **delete** one (confirm the **Undo** toast restores it). Try reps>1 → "est." flag + est. 1RM. Expand **% & plates**. Back on the board, tap the gear → add a 7th lift (Add hides at 10), remove/reorder.
9. **[v4] Run (own tab):** the **top switcher shows Home/Physio/Workout/Run**; open **Run** → confirm the **emerald** theme and that the Workout bottom-nav no longer lists Run. Log a run (distance + min/sec + RPE) → pace shown, appears in Recent + bests; set a **weekly run goal** in Settings → week bar fills. Open a run → edit, then delete → returns to **/run**.
10. **Home:** Running tile links to **/run**; 1RM tile renders after logging.
11. **Settings → Export** then **Restore** → all data incl. 1RMs / tracked lifts / runs round-trips. Confirm the Settings **rest-timer field is gone**.
12. Re-check that **existing data survives** (open a browser profile that already had v3 data — no schema change in v4, so 1RMs/runs/sessions load unchanged).

If anything throws, the most likely culprits are Dexie query shapes or the dark-theme `react-calendar` overrides in `index.css`.

---

## 10. Roadmap / next steps

**Deliberate v1 scope decisions (intentionally simplified):**
- **Metric only (kg/cm).** A `units` field exists on `profile`; wiring an imperial display toggle is a small, isolated change (`lib/units.ts` + display formatters; storage stays metric).
- **No cross-device sync.** Devices are independent IndexedDB stores; the backup `.zip` is the bridge (export → drop in a Drive/OneDrive folder → import on the other device).
- **Desktop layout** is the mobile-first centred column, widened. A persistent left-rail nav on ≥768px is a future enhancement (`BottomNav` is already config-driven).
- **PRs computed on the fly** (no cache tables) — fine at personal scale; add cached PR tables only if the board feels slow.

**Suggested next features (roughly prioritised):**
1. Import the spreadsheet's **historical strength log** (one-time JSON seed → bulk insert into `sessions`/`strengthEntries`).
2. **Imperial units** toggle.
3. **Rest timer** between sets (count-down, reuse the wake-lock pattern from `WodDetailPage`).
4. **Charts** for strength progress (est. 1RM over time per movement) and benchmark-WOD time history — reuse/extend `WeightChart.tsx` (still dependency-free) or add a small lib.
5. **Desktop left-rail** navigation at ≥768px.
6. **Gymnastics skills checklist** (simple boolean milestones).
7. **Merge-mode** restore + optional **records-only cloud sync** (uses the existing `updatedAt` fields).
8. **Tests** — there are none yet. Good first targets: `lib/prs.ts` (PR detection, Epley, Rx/Scaled separation), `lib/bmi.ts` (bands), `lib/dates.ts` (week/streak). Add Vitest (`npm i -D vitest`) — these are pure functions, easy to unit-test.

---

## 11. Deploying to your phone (Android)

Android PWA install needs the built `dist/` served once over **HTTPS** (after install it runs fully offline; the host only ever serves the static shell — your data never leaves the phone):

1. `npm run build`.
2. Host `app/dist/` — easiest is **Netlify drop** (drag the folder onto app.netlify.com → instant HTTPS URL) or **GitHub Pages** (commit + a build action). `base: './'` already handles sub-paths.
3. On the phone, open the URL in Chrome → ⋮ → **Add to Home screen**.
4. Updates: rebuild + re-publish; the phone picks them up via `autoUpdate`.
5. Keep the hosting URL **stable** — a different origin = a different (empty) IndexedDB. The backup/restore in Settings is the safety net.

**Windows install:** open in Edge/Chrome → address-bar **Install** icon → runs in its own window, offline.
