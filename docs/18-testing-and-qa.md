# 18 — Testing & QA

> Expands PRD §24. Test deterministic code, non-deterministic agents, and the actual video output.

## Layers
1. **Unit (deterministic core):** EDD schema validation; lowering (EDD→IR); each compiler pass
   (validate/lint/optimize/schedule); cache-key computation; Edit/Session protocol encoding.
2. **Golden-frame render tests:** fixed EDD + assets → render → compare frames/loudness/format vs
   committed goldens (tolerance; encoder non-determinism pinned). Covers grade, captions, composite,
   export. Run across **both** render paths (native + PNG-seq).
3. **Integration (pipeline):** real tool chains (probe/transcribe/grade/level/compose) on small
   fixtures, across GPU/CPU where the runner allows.
4. **End-to-end:** cockpit → daemon → (stubbed/recorded) agent → render; assert the canonical
   interaction (PRD §18.6) yields a valid deliverable.
5. **Agent eval harness:** recorded fixtures (intent + analysis) → agents → assertions on the EDD
   ("hook ≤ 1.5s", "caption sync ≤ 80ms", "loudness target set", "no static frame > 4s"). Makes
   agent/prompt changes measurable. Rubric-based QA-agent self-eval complements human spot checks.
6. **Determinism:** same EDD + assets + tool versions → same output hash (pinned tolerance).
7. **Performance/regression:** track full + incremental render time on benchmark projects; assert
   "change one caption → only caption track re-renders".
8. **Crash/recovery:** kill app/daemon mid-render → no corrupted cache, committed EDD intact, resume
   from journaled state or clean restart.

## CLI adapter smoke tests
Spawn the Claude CLI on a trivial prompt; assert the stream-json event shapes the `cli-adapter`
expects — catches CLI drift before release (Appendix C §7).

## CI
Windows-first runners (ADR-0007) run unit/integration/golden/e2e on every change; agent evals run on
a (cost-aware) schedule. Releases gated by golden-frame + e2e suites (PRD §25.7).
