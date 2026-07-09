# 16 — Performance

> Expands PRD §22. Responsive UI; fast iteration; exploit GPU but always work on CPU; visible cost.

## Levers
1. **Incremental + content-addressed cache** (the primary lever): unchanged DAG nodes never recompute
   (`16` ‖ `08`). Small EDD change → seconds, not minutes.
2. **GPU acceleration / CPU fallback:** CUDA torch for ASR (30–50×); NVENC for encode; HW decode/
   scale where available; everything has a CPU path (T4).
3. **Parallelism:** independent DAG branches + analysis agents run concurrently, bounded by
   resource-aware pools with backpressure.
4. **Proxies:** low-res preview/QA; final from full-res via the resolution-independent IR.
5. **Background rendering:** queue off the UI thread; progress/ETA; cancellation; completion notify.

## Memory & large projects
Stream media through tools (don't load wholesale); reference large artifacts by path; cap concurrent
heavy ops; spill big intermediates to disk; lazy-load assets/proxies. Long-form/large-project scale
is a roadmap hardening target (Phase 10).

## Agent-layer cost & latency (PRD §22.8)
- Prompt caching: stable context first (frozen system prompt → STYLE.md → sorted tool list), volatile
  last → repeated turns hit the cache. Verify via cache-read tokens.
- Cheap subagents: mechanical work on haiku-4-5 / pure tools; reserve opus-4-8 for judgment.
- Bounded effort/turns: Director caps iteration; QA loop budgeted; effort user-biasable.
- Usage meter: aggregate CLI `usage` events per session + against the plan; warn near limits.

## Resource scheduler
Tags each DAG node gpu|cpu|chrome; routes to the matching pool sized to the hardware profile; the
Optimization agent picks model size/device and proxy-vs-full per target + budget.

## Distributed / cloud (roadmap)
Content-addressed nodes + independent branches → offload heavy final renders to remote workers
(opt-in cloud-render plugin, Phase 7); local cache authoritative.

## Crash recovery
Journaled node state → resume from completed nodes after a crash (`18`, PRD §25.6).

## Targets (PRD §3.3)
Time-to-first-render (fresh machine, 60s, "make a reel") < 15 min incl. setup on a mid NVIDIA laptop;
< 5 min prepared. Incremental: change one caption style → only caption track + composite re-render.
