# Deutschstudio — Architecture (arc42)

> Status: **Draft / in progress** · Last updated: 2026-11-10
> This document follows the [arc42](https://arc42.org) template, kept lean for a small personal project.
> Decisions are recorded as ADRs in [`adr/`](adr/README.md). Feature-dependent sections (5 runtime detail, 6, 8) are filled as we agree on features.

---

## 1. Introduction and Goals

**Deutschstudio** is a personal web app that helps Fauzan systematically move his German from **B1 toward C1**, using his own course material (vocabulary, grammar, speaking phrases, exam notes). The **primary feature is vocabulary training** that is interactive, varied, and good for memory; sentence structure, grammar, and speaking follow later.

### Top goals

1. **Learn vocabulary effectively** through active recall and spaced repetition, in several engaging exercise modes.
2. **Grow with the learner**: content is added by dropping one JSON file per class meeting — no code change — and scales from B2.2 to C1 and beyond.
3. **Shareable**: usable by friends who don't speak Indonesian (multilingual meanings, language toggle).

### Quality goals (see §10)

Simplicity/maintainability · additive content · offline-capable · future-proof to C1 · shareable/multilingual.

### Stakeholders

| Role                                     | Interest                                       |
| ---------------------------------------- | ---------------------------------------------- |
| Fauzan (owner, main user)                | Learn fast, add content easily, track progress |
| Friends / partner                        | Use the app in English, their own progress     |
| Future employers (Praktikum/Werkstudent) | The project doubles as a portfolio piece       |

### MVP scope — vocabulary (confirmed 2026-11-10)

A **daily session** pulls due + new words (default ~15) and **mixes modes** automatically.

MVP exercise modes:

1. **Flashcard + spaced repetition** (self-rated: know / unsure / forgot)
2. **Multiple choice** (DE→meaning and meaning→DE)
3. **Type-the-answer** (active recall)
4. **Article trainer** (der/die/das)

Wave 2 (later): matching pairs · sentence cloze · listen-and-guess (when audio exists).

Cross-cutting: an **"unsure" flag** on every word feeds a focused **"Difficult" pile**;
browse/filter by **Level**, **Meeting (date)**, and **Topic/Tag**; dashboard shows progress per Level / Topic / Meeting + due-today + streak.

**Planned (post-MVP backlog):** progress **export / import as a file** (move progress between devices, and as a backup — since `localStorage` is per-device, see ADR-0004); German-only immersion mode (toward C1); Wave-2 modes (matching, cloze from Lückenübungen, listen-and-guess).

---

## 2. Architecture Constraints

| #   | Constraint                                                                                                      | Reason                                      |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| C1  | Deploy on **Vercel free tier** via **GitHub** (auto-deploy on push)                                             | Accessible anywhere, zero cost              |
| C2  | Project folder may live **inside OneDrive** → **no `node_modules`**                                             | OneDrive sync must not be bloated           |
| C3  | New content added as **drop-in JSON per meeting**, no code edits                                                | Fast weekly updates by a non-heavy workflow |
| C4  | Must also run **locally by double-click** (no server needed)                                                    | Convenience / offline                       |
| C5  | Raw class files (`.docx`, `.pdf`, `.srt`) **stay in OneDrive** as source; only extracted JSON lives in the repo | Separation of source vs. product            |
| C6  | UI content in **German**; discussion/help in Indonesian/English                                                 | Immersion + comprehension                   |

---

## 3. Context and Scope

```
          class materials (.docx/.pdf/.srt, OneDrive)
                        │  (manual/AI extraction)
                        ▼
   ┌──────────────── Deutschstudio ────────────────┐
   │  content JSON  →  build.js  →  data bundle     │
   │                     ▲                          │
   │   App (browser): exercises, SRS, progress      │
   └────────────────────────────────────────────────┘
        │ push                 │ serves           │ stores progress
        ▼                      ▼                  ▼
     GitHub  ───────────►   Vercel CDN        Browser localStorage
```

- **Users**: Fauzan (primary), friends (secondary).
- **External systems**: GitHub (source + trigger), Vercel (build + hosting), the browser's `localStorage` (progress).
- **Out of scope (v1)**: cross-device progress sync, accounts/login, a backend/database.

---

## 4. Solution Strategy

| Concern             | Approach                                                                                | ADR                                                         |
| ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Frontend            | **Vanilla HTML/CSS/JS** (ES modules), no framework                                      | [0001](adr/0001-frontend-vanilla-statt-framework.md)        |
| Content pipeline    | **One JSON file per meeting** + **zero-dependency Node build script** that bundles them | [0002](adr/0002-inhalt-als-dropin-json-plus-buildskript.md) |
| Hosting             | **Vercel + GitHub** auto-deploy                                                         | [0003](adr/0003-hosting-vercel-github.md)                   |
| Progress            | **Browser `localStorage`**, no backend                                                  | [0004](adr/0004-fortschritt-in-localstorage.md)             |
| Meanings / sharing  | **Multilingual meanings (id, en)** + UI language toggle                                 | [0005](adr/0005-mehrsprachige-bedeutungen.md)               |
| Recall / scheduling | **Leitner spaced repetition** (boxes 1–5)                                               | (see §8)                                                    |

---

## 5. Building Block View

### Level 1

- **Content** — `content/wortschatz/<level>/<date>.json`, one file per meeting.
- **build.js** — scans content, validates against the schema, emits a single `data` bundle (and a manifest).
- **App** — loads the bundle and runs:
  - _Exercise Engine_ — renders exercise modes (flashcard, multiple choice, typing, matching, article, cloze).
  - _SRS Scheduler_ — Leitner boxes, decides what is due.
  - _Progress Store_ — reads/writes `localStorage` (per word: box, last seen, "unsure" flag; per category: stats).
  - _UI Shell_ — navigation, dashboard, daily session, language toggle.

**Exercise modes (MVP):** flashcard + SRS · multiple choice (both directions) · type-the-answer · article (der/die/das). **Wave 2:** matching pairs · sentence cloze · listen-and-guess. Every mode consumes the same word object and reports a correct/incorrect result to the SRS Scheduler. The _UI Shell_ offers the one-tap **daily session** and browsing/filtering by level, meeting, and topic; the _Progress Store_ also holds the per-word **"unsure" flag** feeding a **"Difficult" pile**. (Learning model → ADR-0006.)

---

## 6. Runtime View (draft)

- **Daily session**: App asks SRS Scheduler for due words → picks a mode per word → user answers → self-rating updates the box + progress.
- **Add a new meeting**: drop `2026-11-11.json` → push → Vercel runs `build.js` → new words appear, existing progress untouched (keyed by word id).
- **Mark unsure**: user flags a word → it enters the "Difficult" pile for focused review.

> More scenarios added as features are agreed.

---

## 7. Deployment View

| Target         | How                                                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Local**      | Open `index.html` (or run `build.js` once); works offline from `file://` via a generated JS data file (no fetch/CORS issue). |
| **Production** | `git push` → Vercel runs `node build.js` → static output served from CDN.                                                    |

No runtime server. `vercel.json` pins build command + output directory.

---

## 8. Crosscutting Concepts (draft)

- **Vocabulary data model** — _file level_: `schema`, `class`, `level`, `meeting`, `topic`, `sources[]`, `words[]`. _Per word (required)_: `id`, `de`, `typ`, `bedeutung {id, en}`. _Per word (optional)_: `artikel`, `plural`, `trennbar`, `synonyme[]`, `kollokationen[]`, `gegenteil[]`, `hinweis {id, en}`, `beispiele[{de, id, en}]`, `tags[]`. `typ` ∈ {Nomen, Verb, Adjektiv, Redewendung, Wendung, Wortfeld}. Field keys are German by decision; meanings/examples carry `id` + `en`.
- **Spaced repetition**: Leitner boxes 1–5; correct → up a box (longer interval), wrong → back to box 1.
- **i18n**: meanings stored per language; a UI toggle switches display language; German word + example are language-neutral.
- **Persistence**: namespaced `localStorage` keys; progress keyed by word `id` so content can change without losing history.
- **Content identity**: `id` = stable per word (e.g., `level-date-slug`) so re-imports and edits don't duplicate.
- **Content pipeline**: one meeting = **all vocabulary files in that meeting's folder, merged** (daily `*_Wortschatz.docx` + thematic `Wortschatz_*_Übungen.docx`), deduplicated — not only the daily file. Gap-fill sheets (Lückenübungen) inside those files are a ready-made source for the future cloze mode.

---

## 9. Architecture Decisions

See [`adr/README.md`](adr/README.md). Current: ADR-0001 … ADR-0006.

---

## 10. Quality Requirements

| Quality                      | Scenario                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| Simplicity / maintainability | A new exercise mode or content field can be added without a build toolchain beyond one Node script. |
| Additive content             | Adding a meeting = drop one JSON file + push; no code change.                                       |
| Offline-capable              | App runs fully from a local file, no network.                                                       |
| Future-proof to C1           | Starting C1 = add `content/wortschatz/C1/...`; same engine.                                         |
| Shareable / multilingual     | A non-Indonesian speaker uses the app end-to-end in English.                                        |

---

## 11. Risks and Technical Debt

| Risk                                                 | Mitigation                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Vanilla gets verbose as features grow                | Clean module split; data already in JSON → migrating to Vite/React later is low-cost |
| `.git` inside OneDrive can cause sync churn/locks    | Accept for now; option to move repo out of OneDrive if it bites                      |
| `localStorage` is per-device (no sync)               | v1 accepts it; later add progress export/import as a file                            |
| Content extraction accuracy from `.docx`/transcripts | Pilot one meeting, review schema + quality before bulk generation                    |

---

## 12. Glossary

| Term         | Meaning                                    |
| ------------ | ------------------------------------------ |
| Wortschatz   | Vocabulary                                 |
| Redemittel   | Ready-made speaking phrases                |
| SRS          | Spaced Repetition System                   |
| Leitner      | Box-based SRS method                       |
| arc42        | Architecture documentation template        |
| ADR          | Architecture Decision Record               |
| Drop-in JSON | A content file added without changing code |
