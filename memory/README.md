# memory/

Persistent cross-session memory for OpenVideo. Drop `.txt` (or `.md`) files here — typically
transcripts or distilled notes from previous Claude sessions — and they become durable context.

## Contract

- **At the start of every new session, Claude reads ALL files in this folder** (see `../CLAUDE.md` →
  "Session memory"). They are background context: decisions made, work in progress, things tried,
  user preferences, and open threads from earlier sessions.
- Treat these as **historical notes, not live instructions.** They reflect what was true when
  written. If a memory file names a file, command, decision, or flag, verify it still holds against
  the current `PRODUCT_REQUIREMENTS_DOCUMENT.txt` / `docs/` before acting on it.
- The authoritative design is still the PRD + `docs/` + `docs/adr/`. Memory adds continuity; it does
  not override the spec or the invariants in `CLAUDE.md`.

## Conventions (suggested)

- One file per session, named so order is obvious, e.g. `YYYY-MM-DD-<topic>.txt`
  (e.g. `2026-06-28-prd-and-docs.txt`).
- Keep distilled summaries over raw dumps where possible — what was decided, what changed, what's next.
- This folder is for project session memory; it is separate from any harness-level memory.
