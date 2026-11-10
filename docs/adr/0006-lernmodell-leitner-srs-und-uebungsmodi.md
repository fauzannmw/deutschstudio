# ADR-0006: Learning model — Leitner SRS, mixed daily session, extensible exercise modes

- Status: Accepted
- Date: 2026-11-10

## Context
The core goal is durable vocabulary memory via active recall and spaced repetition, without boredom. The app must schedule reviews, support several exercise modes over the *same* word data, and let the owner add modes later (matching, cloze, audio) and whole new skills (grammar, sentence structure, speaking) without reworking the engine.

## Decision
- **Spaced repetition: Leitner boxes 1–5.** A correct answer promotes a word one box (longer interval); an incorrect/"forgot" answer resets it to box 1. Scheduling is interval-per-box.
- **Daily session** pulls due + new words (default ~15) and **mixes modes** per word.
- **MVP modes:** flashcard, multiple choice (both directions), type-the-answer, article (der/die/das).
- **Extensible modes:** each mode is an independent renderer that takes a word object and emits a correct/incorrect result; adding a mode does not touch the scheduler or store.
- **"Unsure" flag** is independent of box state and feeds a focused "Difficult" pile.

## Consequences
- **+** Simple, well-understood algorithm; easy to implement in vanilla JS; transparent to the learner.
- **+** New modes/skills are additive (supports the "grow to C1" goal).
- **−** Leitner is coarser than algorithms like SM-2/FSRS (no per-word ease factor); acceptable for a personal app, and replaceable later since scheduling is isolated.

## Alternatives considered
- **SM-2 / FSRS** — better spacing accuracy, more complexity. Deferred; the Progress Store keeps enough data (last-seen, box) to migrate later.
- **One fixed exercise type** — simpler but boring and weaker for recall. Rejected.
