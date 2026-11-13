# Content schema — Wortschatz (strict)

> **Handing this content-creation task to another agent?** Give it
> [`content-agent-brief.md`](content-agent-brief.md) — a self-contained
> task brief (works even if that agent has no repo access). The formal,
> machine-readable contract is [`wortschatz.schema.json`](wortschatz.schema.json)
> (JSON Schema draft-07). This document is the narrative/human-readable version
> of the same rules.

One JSON file per meeting: `content/wortschatz/<Level>/<YYYY-MM-DD>.json`.
`build.js` bundles **and validates** these files. An invalid file **fails the build** (and thus the Vercel deploy), so every card must follow this schema exactly.

## File level

| Field | Type | Required | Notes |
|---|---|:--:|---|
| `schema` | number | ✓ | currently `1` |
| `class` | string | ✓ | e.g. `"B2.2"` |
| `level` | string | ✓ | e.g. `"B2"` |
| `meeting` | string | ✓ | ISO date `"YYYY-MM-DD"` |
| `topic` | string | ✓ | short title of the session |
| `sources` | string[] | – | source file paths (provenance) |
| `words` | Word[] | ✓ | the cards |

## Word (one card)

**Required:** `id`, `de`, `typ`, `modi`, `bedeutung`
**Optional:** `artikel`, `plural`, `trennbar`, `synonyme`, `kollokationen`, `gegenteil`, `hinweis`, `beispiele`, `tags`

| Field | Type | Req | Meaning |
|---|---|:--:|---|
| `id` | string | ✓ | stable, unique, e.g. `b2.2-2026-11-04-urlaubsantrag` |
| `de` | string | ✓ | the German headword/phrase |
| `typ` | enum | ✓ | `Nomen` · `Verb` · `Adjektiv` · `Adverb` · `Redewendung` · `Wendung` · `Wortfeld` |
| `modi` | string[] | ✓ | which **quiz** modes apply — see below |
| `bedeutung` | `{id, en}` | ✓ | meaning in Indonesian + English |
| `artikel` | enum | – | `der` · `die` · `das` (nouns) |
| `plural` | string | – | plural form |
| `trennbar` | boolean | – | separable verb |
| `synonyme` | string[] | – | synonyms |
| `kollokationen` | string[] | – | collocations / patterns |
| `gegenteil` | string[] | – | opposites |
| `hinweis` | `{id, en}` | – | usage note |
| `beispiele` | `{de, id, en?}[]` | – | example sentences |
| `tags` | string[] | – | topic tags |

Field keys are German by decision; `bedeutung`/`beispiele` carry `id` + `en`.
**Key order** (convention): `id, de, artikel, plural, typ, trennbar, modi, bedeutung, synonyme, kollokationen, gegenteil, hinweis, beispiele, tags`.

## `modi` — which exercise modes a card supports

Array, each value one of:

| Value | Mode |
|---|---|
| `"mc"` | Multiple Choice |
| `"tippen"` | Eintippen (type the word) |
| `"artikel"` | Artikel (der/die/das) |

**Karteikarten (review) is always available** for every card and is *not* listed in `modi`.
`modi` only controls the active quizzes.

- `["mc","tippen","artikel"]` → appears in all three quizzes.
- `["mc"]` → Multiple Choice only.
- `[]` → **Karteikarten only** — use this for group/reference cards (`Wortfeld`) whose "meaning" is a category description, not a translatable word.

`modi` is the **final authority** per card. The table below is only a sensible starting point.

| `typ` | default `modi` | reason |
|---|---|---|
| `Nomen` with `artikel` der/die/das | `["mc","tippen","artikel"]` | full single word |
| `Nomen` without a clear article | `["mc","tippen"]` | typeable, but no article drill |
| `Verb` / `Adjektiv` / `Adverb` (single lexeme) | `["mc","tippen"]` | typeable |
| `Redewendung` / `Wendung` (phrase) | `["mc"]` | meaning is concrete, but too long to type |
| `Wortfeld` (group/list) | `[]` | not a single meaning → Karteikarten only |
| any word whose `de` contains `/` or `↔` | drop `"tippen"` | not a single typeable form |

## Validation (build fails if)

- `modi` is missing or not an array
- a value is outside `mc` / `tippen` / `artikel`
- `modi` contains `"artikel"` but `artikel` is not `der`/`die`/`das`
- duplicate `id`, or missing `id`/`de`

## Example

```json
{
  "id": "b2.2-2026-11-04-urlaubsantrag",
  "de": "Urlaubsantrag", "artikel": "der", "plural": "Urlaubsanträge",
  "typ": "Nomen", "modi": ["mc", "tippen", "artikel"],
  "bedeutung": { "id": "permohonan cuti", "en": "holiday/leave request" },
  "beispiele": [{ "de": "Ich stelle einen Urlaubsantrag.", "id": "Saya mengajukan cuti.", "en": "I submit a leave request." }],
  "tags": ["Arbeit", "Verwaltung"]
}
```

```json
{ "id": "b2.2-2026-11-04-rektion-auf", "de": "Nomen/Verben mit „auf\"",
  "typ": "Wortfeld", "modi": [],
  "bedeutung": { "id": "kata + preposisi 'auf'", "en": "nouns/verbs taking 'auf'" },
  "kollokationen": ["stolz auf", "Vorfreude auf", "sich freuen auf", "achten auf"] }
```
