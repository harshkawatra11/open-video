# ADR-0013: Two-stage prompt → PRD-level prompt engine

- **Status:** Accepted (built)
- **Related:** PRD §16; `packages/prompt`; `apps/daemon` (/api/refine-prompt, session refine flag)

## Context
Most users are not skilled prompt engineers. A one-line brief underspecifies a video and yields weak,
generic results. The user asked that a raw brief first be rewritten into a detailed, PRD-level
video-production prompt — and that the *drafted PRD prompt*, not the raw brief, drive the agent.

## Options considered
1. **Two-stage prompting:** user brief → (template + Claude Opus, low effort) → a PRD-level prompt
   saved as a `.txt` → that PRD prompt is what the production agent receives. The template is supplied
   by the project owner (env/file) with a clearly-marked built-in placeholder until then.
2. **Send the raw brief directly** — simplest; underspecified; inconsistent quality.
3. **A fixed local heuristic expander** — deterministic but rigid; misses the model's judgment.

## Decision
Option 1. `packages/prompt` provides `loadRefineTemplate` (env `OPENVIDEO_PROMPT_TEMPLATE` → repo
`prompts/refine-to-prd.template.md` → built-in placeholder) + `buildRefineInput({{USER_PROMPT}})`. The
daemon's `refineToPrd()` runs Opus (effort `OPENVIDEO_REFINE_EFFORT`, default `low`) via the
cli-adapter, saves the PRD prompt under `WORKDIR/prds/`, and `/api/session {refine:true}` runs the
agent with the PRD prompt. The cockpit exposes a "Draft to PRD first" toggle. The real template is
user-supplied; OpenVideo ships a placeholder and never authors the authoritative template itself.

## Rationale
Lifts output quality for non-experts, keeps the human's intent while adding production rigor, and is a
thin, swappable layer (template is data; effort/flag are env-tunable; `--effort` verified on the CLI).

## Consequences
- Positive: dramatically better results from short briefs; PRD prompt is saved + inspectable.
- Negative: an extra Opus call (low effort) adds latency/cost; quality depends on the template.
- Mitigations: low effort by default; opt-in toggle; placeholder until the owner provides the template.

## Revisit when
The owner finalizes the authoritative template, or a per-vertical template set is wanted.
