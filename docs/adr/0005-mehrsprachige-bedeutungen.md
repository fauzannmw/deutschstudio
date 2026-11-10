# ADR-0005: Multilingual meanings (id + en) with UI language toggle

- Status: Accepted
- Date: 2026-11-10

## Context
Indonesian meanings help the owner's memory and match the class rule. But he may share the app with friends/partner who don't read Indonesian. The German word and example sentence are language-neutral; only the "meaning" needs translation.

## Decision
Store meanings as a **language-keyed object**, e.g. `"bedeutung": { "id": "…", "en": "…" }` (same for example translations). The UI has a **language toggle** (default `id`) that switches which meaning is shown. One content set serves everyone. The schema is open to more languages (and a future German-only "immersion" mode toward C1).

## Consequences
- **+** One dataset, no per-language fork; shareable with non-Indonesian speakers.
- **+** Future-proof: add a language key without schema change; supports immersion mode later.
- **−** Slightly more work per word during extraction (both `id` and `en`) — acceptable since generation is assisted.

## Alternatives considered
- **Indonesian only** — simplest, but blocks sharing. Rejected.
- **Separate files per language** — duplication and drift. Rejected.
