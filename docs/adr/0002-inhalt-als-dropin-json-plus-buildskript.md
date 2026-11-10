# ADR-0002: Content as drop-in JSON per meeting + zero-dependency build script

- Status: Accepted
- Date: 2026-11-10

## Context
New vocabulary arrives every class meeting. The owner wants to add it by dropping a file and pushing to GitHub — **without editing code** and without maintaining an index by hand. A browser cannot list a folder's contents at runtime, so the set of content files must be discovered at build time.

## Decision
- Store content as **one JSON file per meeting**: `content/wortschatz/<level>/<YYYY-MM-DD>.json`.
- A **zero-dependency Node build script (`build.js`)** scans that folder, validates each file against the schema, and emits a **single generated data file** (plus a manifest) that the app loads. Generating a plain `.js` data file keeps local `file://` use working (no fetch/CORS).
- On Vercel the build command is `node build.js`; adding a file + push triggers a rebuild automatically.

## Consequences
- **+** Adding content = drop one JSON + push; no code change, no manual index.
- **+** Still zero `node_modules`; works locally and on Vercel.
- **+** Build-time validation catches malformed content early.
- **−** Content changes require a rebuild to appear (acceptable: Vercel rebuilds on every push).
- **−** All content is bundled into one data file; fine for text at this scale, revisit only if it grows very large.

## Alternatives considered
- **Hand-maintained `manifest.json`** listing files — simplest, but the owner would have to edit it each time (easy to forget). Rejected.
- **Vite `import.meta.glob`** — elegant auto-discovery, but pulls in the framework/`node_modules`. Rejected per ADR-0001.
