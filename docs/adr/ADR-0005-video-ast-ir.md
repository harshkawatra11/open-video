# ADR-0005: Editing as compilation — Video AST (EDD) + IR + execution DAG

- **Status:** Accepted
- **Related:** PRD §11, §12, §13, §14, §30.3

## Context
Edits must be explainable, reproducible, inspectable, and version-controlled, and re-rendering after
a small change must be fast. The PoC produced edits as ad-hoc shell sequences — powerful but not
reproducible, inspectable, or incremental, with no clean reasoning/execution boundary.

## Options considered
1. **Video AST/EDD + IR + execution DAG** — agents author a typed, JSON, git-versioned Edit
   Decision Document (the AST); a compiler lowers it to an IR, runs passes (validate/lint/optimize/
   schedule), and emits a content-addressed execution DAG. Explainable, reproducible, incremental,
   cacheable. Con: up-front complexity.
2. **Direct tool scripting** (PoC mode) — simplest. Con: not reproducible/inspectable/incremental;
   no typed boundary between model and tools.
3. **Adopt OpenTimelineIO as the native model** — interoperable, standard. Con: NLE-centric,
   heavier, less intent-bearing than a purpose-built EDD.

## Decision
Adopt the **Video AST (EDD) + IR + execution DAG** model as the product core. Keep the EDD
intent-bearing and high-level; resolve to concrete operations in lowering. Consider OpenTimelineIO
only as an optional import/export interchange format, not the internal AST.

## Rationale
This is the well-trodden compiler architecture applied to video; it directly delivers the product's
trust properties (explainable/reproducible/inspectable/versioned) and its performance properties
(incremental + cached), while cleanly separating reasoning (authoring the AST) from execution.

## Consequences
- Positive: explainability, reproducibility, incrementality, caching, a clean agent/engine contract.
- Negative: more architecture to build than direct scripting.
- Mitigations: ship the schema + validator + lowering first (Phase 1); reuse standard compiler
  patterns; the PoC's outputs map directly onto EDD nodes.

## Revisit when
If interop with NLEs becomes a primary requirement (elevate OTIO to a larger role).
