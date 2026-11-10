# ADR-0004: Progress stored in browser localStorage (no backend)

- Status: Accepted
- Date: 2026-11-10

## Context
The app tracks per-word SRS state, "unsure" flags, and per-category progress. A backend/database/login would add cost and complexity the owner doesn't want for v1. Friends using the app should get their own independent progress.

## Decision
Store all progress in the browser's **`localStorage`**, under a namespaced key. Progress is keyed by stable word `id` so content edits don't lose history. No backend, no accounts.

## Consequences
- **+** Zero infrastructure; works offline; each browser/person has their own progress.
- **+** Keeps the app fully static (supports ADR-0001/0003).
- **−** Progress is **per device/browser** — not synced across devices.
- **−** Clearing browser data loses progress.
- Mitigation (later): **export/import progress as a JSON file** for device moves and backup.

## Alternatives considered
- **Backend + login (e.g., Supabase/Firebase)** — enables sync, but adds accounts, cost, and a server dependency. Deferred until genuinely needed.
