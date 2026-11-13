# Instructions for any agent creating or editing files in this folder

Before creating or changing any `*.json` file under `content/wortschatz/`,
read, in order:

1. [`../../docs/content-agent-brief.md`](../../docs/content-agent-brief.md) —
   the full, self-contained task brief (output location, required fields, and
   the `modi` rule, which is the one most often gotten wrong).
2. [`../../docs/wortschatz.schema.json`](../../docs/wortschatz.schema.json) —
   the formal JSON Schema (the authoritative contract).

After writing or changing a file here, **always** run, from the project root:

```bash
node build.js
```

It must print `build ok: ...` with zero errors. If it prints
`BUILD FEHLGESCHLAGEN`, fix every listed error and rerun before considering
the task done.

Do not edit app code (`app/`, `build.js`) from this folder's context — this
folder is content only.
