# ADR-0003: Hosting on Vercel with GitHub auto-deploy

- Status: Accepted
- Date: 2026-11-10

## Context
The app must be reachable anywhere (including the phone), free, and updated easily from the owner's content workflow.

## Decision
Host on **Vercel (free tier)** connected to a **GitHub** repository. Every push rebuilds (`node build.js`) and redeploys. Settings pinned in `vercel.json` (build command + output directory).

## Consequences
- **+** Static output on a CDN: fast, reliable, no server runtime, no cold starts, no runtime cost.
- **+** Deploy workflow matches content workflow: push = publish.
- **+** GitHub is the authoritative backup, so OneDrive backup of the code is unnecessary.
- **−** Requires a GitHub repo and a Vercel account linked to it (one-time setup).
- Fallback: the generated data bundle can be committed, so the site works even without the build step.

## Alternatives considered
- **GitHub Pages / Netlify** — comparable; Vercel chosen for its zero-config build + the owner's preference.
- **Pure local only** — rejected: must be accessible anywhere.
