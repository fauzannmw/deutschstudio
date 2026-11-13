# ADR-0007: Per-card exercise modes declared in the content (`modi`)

- Status: Accepted
- Date: 2026-11-10

## Context
The app has several exercise modes (flashcard, multiple choice, typing, article). Initially the app *inferred* which modes a card supported with heuristics (word length, has-article, etc.). This leaked unsuitable cards into the wrong mode — most visibly, grouping/`Wortfeld` cards (e.g. "Nomen/Verben mit auf", whose "meaning" is a category description) showed up as Multiple Choice questions with nonsensical options. The owner wants the mode fit decided explicitly and strictly, in the content.

## Decision
Each card declares a **`modi`** array in its JSON — the quiz modes it supports, each one of `mc` (Multiple Choice), `tippen` (Eintippen), `artikel` (der/die/das). **Karteikarten (review) is always available** and is not listed. `[]` means Karteikarten only (group/reference cards).

- The app reads `modi` to decide eligibility (no more heuristic inference).
- `build.js` **validates strictly** and fails the build on a missing/invalid `modi` (or `artikel` mode without a der/die/das article), so bad content cannot deploy.
- The full template lives in [`docs/content-schema.md`](../content-schema.md), the formal contract in [`docs/wortschatz.schema.json`](../wortschatz.schema.json), and the self-contained hand-off brief for another authoring agent in [`docs/content-agent-brief.md`](../content-agent-brief.md).

## Consequences
- **+** No more nonsensical quizzes; each card appears only where it makes sense.
- **+** Mode fit is explicit, reviewable in the JSON, and enforced at build time.
- **+** New cards must state `modi` — deliberate and consistent.
- **−** Slightly more to fill per card (one array); mitigated by sensible per-`typ` defaults and the migration script that backfilled all existing cards.

## Alternatives considered
- **Keep heuristic inference** — no extra field, but unreliable (the bug above). Rejected.
- **Explode every group card into individual testable cards** — best for active recall, but a large content effort. Deferred: `Wortfeld` cards stay as Karteikarten references for now; the valuable ones (Rektion, Nomen-Verb-Verbindungen) can be split later.
