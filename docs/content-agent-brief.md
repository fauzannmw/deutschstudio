# Content Authoring Brief — for an agent generating Deutschstudio vocabulary JSON

> **This document is self-contained.** Paste it whole as instructions to another
> agent (even one with no access to this repository) and it has everything
> needed to produce a correct file. The formal machine-readable contract is
> [`wortschatz.schema.json`](wortschatz.schema.json) (JSON Schema draft-07); this
> brief restates it in a task-oriented way with the reasoning spelled out, plus
> the one rule that is most often gotten wrong (`modi`).

## Your task

Convert German class materials (a `*_Wortschatz.docx`, vocabulary handouts,
notes) for **one class meeting** into **one JSON file** matching the schema
below. Only produce content JSON — never edit app code (`app/`, `build.js`).

## Output location

```
content/wortschatz/<Level>/<YYYY-MM-DD>.json
```

- `<Level>` = the class folder, e.g. `B2.1`, `B2.2`.
- `<YYYY-MM-DD>` = the meeting's date.
- One file per meeting. If a meeting's content is split across several source
  files (a daily `*_Wortschatz.docx` plus one or more thematic
  `Wortschatz_*_Übungen.docx`), **merge them into one output file** and list
  all of them in `sources`.

**Only vocabulary belongs in this file.** Exclude:
- pure grammar drills (conjunctions, tenses, word order / `Position von
  "nicht"`, comparison forms, `je...desto`, etc.),
- pure speaking-phrase sheets (`Redemittel` for discussion prompts).

These belong to other modules (grammar / speaking), not here. If a source
document mixes vocabulary with grammar or Redemittel, extract only the
vocabulary and silently drop the rest (don't ask about it, don't force it in).

## File shape

```json
{
  "schema": 1,
  "class": "B2.2",
  "level": "B2",
  "meeting": "2026-11-18",
  "topic": "Short title of the session's theme",
  "sources": ["path/to/the/original/file.docx"],
  "words": []
}
```

`schema`, `class`, `level`, `meeting`, `topic`, `words` are all required.
`sources` is optional but expected (list every source file you drew from).

## Word object

**Required on every word:** `id`, `de`, `typ`, `modi`, `bedeutung`.
**Optional:** `artikel`, `plural`, `trennbar`, `synonyme`, `kollokationen`,
`gegenteil`, `hinweis`, `beispiele`, `tags`.
**No other keys are allowed** — this is enforced strictly.

| Field | Type | Rule |
|---|---|---|
| `id` | string | Unique and stable, lowercase, pattern `<class-lower>-<meeting>-<slug>`, e.g. `b2.2-2026-11-18-klaeren`. Never reuse an `id`, even across files. |
| `de` | string | The German headword or phrase, exactly as used in class. |
| `typ` | string | One of `Nomen`, `Verb`, `Adjektiv`, `Adverb`, `Redewendung`, `Wendung`, `Wortfeld` — see below. |
| `modi` | string[] | Which **quizzes** this card appears in. See the dedicated section below — read it fully before writing any card. |
| `bedeutung` | object | `{ "id": "...", "en": "..." }`, meaning in Indonesian and English. Both keys required. |
| `artikel` | enum | `der` \| `die` \| `das` — nouns only. |
| `plural` | string | plural form, when relevant. |
| `trennbar` | boolean | `true` for a separable verb. |
| `synonyme` | string[] | synonyms (a short parenthetical gloss is fine). |
| `kollokationen` | string[] | fixed collocations / patterns. |
| `gegenteil` | string[] | opposites. |
| `hinweis` | object | `{ "id": "...", "en": "..." }` — a usage note. **Use this to flag uncertainty** (ambiguous or self-contradictory source material, a guess you're not fully sure of) instead of silently inventing an answer. |
| `beispiele` | object[] | `[{ "de": "...", "id": "...", "en": "..." }]` — example sentences; `de` and `id` required per example, `en` optional. |
| `tags` | string[] | free-form topic tags, e.g. `"Beruf"`, `"C1"`. |

### Choosing `typ`

- **`Nomen`** — a noun (set `artikel` when known).
- **`Verb`** — a verb or verb phrase, e.g. `"sich einigen auf"`.
- **`Adjektiv` / `Adverb`** — a single descriptive/adverbial word.
- **`Redewendung`** — a fixed idiom with one clear meaning, e.g. `"Fuß fassen"`.
- **`Wendung`** — a shorter fixed phrase/pattern, less idiomatic than `Redewendung`.
- **`Wortfeld`** — **a group or list, not a single translatable word**: related
  collocations bundled together (e.g. "Nomen/Verben mit auf"), a list of items
  (e.g. hotel meal-plan types), or several synonym pairs grouped as one card.
  Its "meaning" is a *category description*, not a translation of one word.

## `modi` — the field people get wrong most often

**Karteikarten (flashcard review) is always available for every card and must
NOT be listed in `modi`.** `modi` only lists which of the three *active
quizzes* a card is eligible for:

| Value | Quiz |
|---|---|
| `"mc"` | Multiple Choice |
| `"tippen"` | Type-the-word (Eintippen) |
| `"artikel"` | der/die/das drill — only valid if `artikel` is set |

Decide in this order:

1. **Is this a `Wortfeld` (group/list) card?** → `modi: []`, full stop. A
   group's "meaning" is a category label, not a quizzable answer — testing it
   with Multiple Choice produces nonsense questions (a real bug this project
   hit once; do not reintroduce it).
2. **Does it have a real `bedeutung`?** (every card should) → include `"mc"`.
3. **Is `de` one single, literally-typeable form** — no `/`, `↔`, `„`, `(`
   characters, at most 3 words? → include `"tippen"`. If `de` is a
   slash-joined pair (`"fest / flüssig"`) or a longer descriptive phrase,
   leave `"tippen"` out.
4. **Is `typ` `Nomen` with `artikel` set to `der`/`die`/`das`?** → include
   `"artikel"`. Otherwise leave it out.

Examples:
- `{"de": "Urlaubsantrag", "artikel": "der", "typ": "Nomen"}` → `["mc","tippen","artikel"]`
- `{"de": "scheitern", "typ": "Verb"}` → `["mc","tippen"]`
- `{"de": "etwas in Aussicht stellen", "typ": "Redewendung"}` (4 words) → `["mc"]`
- `{"de": "Nomen/Verben mit „auf\"", "typ": "Wortfeld"}` → `[]`

## Validation — do this before finishing, every time

Run from the project root:

```bash
node build.js
```

It must print `build ok: <N> words from <N> files across <N> meetings`. If it
instead prints `BUILD FEHLGESCHLAGEN` with a list of errors, **fix every
listed error and rerun** until it succeeds. The task is not done until this
passes — don't skip or hand-wave this step.

## Worked example (copy the shape, not the content)

```json
{
  "schema": 1,
  "class": "B2.2",
  "level": "B2",
  "meeting": "2026-11-18",
  "topic": "Example topic",
  "sources": ["B2.2 .../18.11._Wortschatz.docx"],
  "words": [
    {
      "id": "b2.2-2026-11-18-klaeren",
      "de": "klären", "typ": "Verb", "modi": ["mc", "tippen"],
      "bedeutung": { "id": "mengklarifikasi / membereskan", "en": "to clarify / sort out" },
      "beispiele": [
        { "de": "Es gibt noch ein paar Punkte, die wir klären müssten.", "id": "Masih ada beberapa poin yang perlu kita bereskan.", "en": "There are still a few points we should clarify." }
      ],
      "tags": ["Kommunikation"]
    },
    {
      "id": "b2.2-2026-11-18-rektion-an",
      "de": "Nomen/Verben mit „an\"", "typ": "Wortfeld", "modi": [],
      "bedeutung": { "id": "kata + preposisi 'an'", "en": "nouns/verbs taking 'an'" },
      "kollokationen": ["das Interesse an (minat pada)", "teilnehmen an (ikut serta dalam)"]
    }
  ]
}
```

## If you're unsure about anything

- Don't invent a meaning or translation you're not confident about. Give your
  best attempt and add a `hinweis` flagging the uncertainty — or stop and ask
  the project owner before finishing.
- Don't silently "correct" apparent errors in the source class material (e.g.
  contradictory definitions in the teacher's notes). Keep the content as-is
  and flag it with `hinweis` instead.
- Never invent vocabulary that isn't present in the source material.
