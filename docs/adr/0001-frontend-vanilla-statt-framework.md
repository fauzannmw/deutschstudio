# ADR-0001: Frontend in vanilla JS instead of a framework

- Status: Accepted
- Date: 2026-11-10

## Context
The project folder may live inside the university OneDrive. A framework (React/Vite) requires `node_modules` (hundreds of MB, thousands of small files), which bloats OneDrive sync and consumes space. The owner also wants everything (class materials + app + content) in one place so updates are visible together, and the ability to open the app locally by double-click.

## Decision
Build the frontend in **vanilla HTML/CSS/JS (ES modules)**, with **no frontend framework** and **no runtime dependencies**. The only Node code is a small, zero-dependency build script (see ADR-0002).

## Consequences
- **+** No `node_modules` → project can stay inside OneDrive without sync problems.
- **+** Opens locally by double-click; trivial to host as static files.
- **+** Content lives as JSON, decoupled from UI → a later migration to Vite/React is low-cost.
- **−** More manual/verbose code than a component framework as features grow; state (SRS, progress) is managed by hand.
- Mitigation: clean module split (exercise engine / SRS / progress / UI); revisit if the app outgrows vanilla.

## Alternatives considered
- **Vite + React + TypeScript** — nicer DX and state handling, but needs `node_modules` → repo must leave OneDrive, splitting materials and app across two trees. Rejected for now given the owner's priorities.
