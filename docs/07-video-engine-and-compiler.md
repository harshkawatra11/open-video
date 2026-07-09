# 07 — Video Engine & Compiler

> Expands PRD §11–§14. Editing as compilation: intent → plan → EDD (AST) → IR → execution DAG →
> render (ADR-0005).

## The compilation model
```
Front end : NL intent → (Intent Engine) → structured intent
            structured intent + analysis → (Planner) → creative blueprint
Middle    : blueprint → (assembly) → EDD (Video AST)
            EDD → (lowering) → IR (typed, normalized, resolution-independent)
            IR → (passes: validate, lint, optimize, schedule) → scheduled IR
Back end  : IR → (codegen) → execution DAG (content-addressed tool calls)
            DAG → (scheduler/executor) → rendered media
```

## EDD (the AST)
Intent-bearing, declarative, high-level JSON (PRD §13.2, Appendix D §1). Carries provenance per node.
Examples of intent-level directives the EDD holds: "alternating 3% breathe punch-ins on cuts",
"captions in the brand style", "tonemap + light grade". An "edit" = a validated EDD patch + git
commit.

## Lowering (EDD → IR)
- Resolve `styleRef`/tokens to concrete values from `STYLE.md` (fonts, colors, sizes, eases).
- Expand directives to explicit per-clip transforms/keyframes (compute the punch-in zoom curve per
  segment so consecutive segments meet at the same scale — no pop).
- Resolve asset paths + proxies; normalize time bases to project fps; flatten transitions/effects
  into ordered parameterized ops.
- IR is resolution-independent so preview and final share it.

## Passes
- **Validation** (blocking): schema validity, monotonic/non-overlapping times, resolvable refs, in/out
  within bounds, no caption edge-clipping, sane export. Precise diagnostics (Validation agent wraps).
- **Lint** (advisory): "static frame > 3–4 s", "caption over eyeline", "loudness target missing",
  "graphic hides speaker > 2.5 s" → Simulation/QA + user.
- **Optimization:** dedupe ops, hoist shared sub-renders, proxy vs full, GPU vs CPU, cache boundaries.
- **Scheduling:** topological order into the DAG; group by resource; parallelize independent branches.

## Execution DAG (codegen target)
Nodes = typed tool calls with resolved inputs/params and a deterministic `cacheKey = hash(op +
inputs + params + toolVersions)`; edges = data deps. The DAG is the single source of truth for what
runs and in what order (PRD §14.1).

## Incremental + cached
A change recompiles only the affected subtree; unchanged nodes hit the content-addressed cache.
Changing a caption color re-renders the caption track + final composite only — not grade/audio
(success criterion T3). Asset hashing underpins keys (PRD §17.4).

## Scene & motion graphs
The EDD's timeline/tracks form a scene graph; motion (punch-ins, graphic entrances, caption karaoke)
is expressed via the motion-language tokens and lowered to eased keyframes. (Optional ComfyUI-style
power-user graph view is a roadmap idea.)

## Diagnostics & error model
Every pass emits structured diagnostics: code, severity, offending EDD node path, human explanation,
suggested fix — rendered in the cockpit and consumable by agents. Tool failures classified
transient/fallback/fatal.

## Why this design
Separates "what the user wants" (EDD) from "how to make it" (IR/DAG); same intent → preview/final,
CPU/GPU, native/fallback render without re-asking the model; edits are data in git; renders are fast
(incremental/cached). It's the standard compiler architecture applied to video — low novelty risk.
