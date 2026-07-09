# 08 — Execution & Render Graph

> Expands PRD §14. The DAG is the executable artifact; the scheduler runs it incrementally and
> cached.

## Node shape
```
{ id, op, inputs[], params{}, key: sha256(op+resolvedInputs+params+toolVersions),
  resource: "gpu|cpu|chrome", outputs[], status: "queued|running|done|failed|cached" }
```
Edges = data dependencies (composite ← grade + caption-render + audio-level).

## Scheduler
- Topological order; run independent branches in parallel (grade ‖ caption PNGs ‖ audio level).
- Resource-aware pools: GPU (NVENC/CUDA), CPU (libx264/filtergraphs), Chrome (Remotion). Sized to the
  hardware profile.
- Honors usage/cost budget + preview-vs-final quality (Optimization agent input).

## Render queue + workers
Jobs = DAG subgraphs → bounded worker pool. Streamed progress (phase/%/ETA), cancellation,
backpressure. Long jobs background + notify on completion (PoC F9).

## Content-addressed cache
Output stored under `key`; unchanged key → instant reuse. Per-project (+ optional shared global
cache for common ops). LRU eviction within a size budget; integrity verified on read. Safe to delete
(regenerable).

## Incremental rendering
EDD change → recompile only the affected subtree → unchanged nodes hit cache. Caption-color change →
caption track + final composite only. Delivers the "small change = fast re-render" criterion (T3).

## Proxies
Low-res proxies generated on ingest (or lazily) for fast preview/QA; final uses full-res from the
same resolution-independent IR.

## Cancellation, progress, journaling
Nodes killable; partial outputs discarded (never half-written into cache). The scheduler journals
node state so a crash resumes from completed nodes rather than restarting (PRD §24.9, §25.6).

## Failure & fallback
Node failure classified: transient (retry w/ backoff), fallback-eligible (native Remotion compositor
→ PNG-seq + FFmpeg; GPU encode → CPU encode), or fatal (precise diagnostic; stop that branch).

## Distributability (roadmap)
Because nodes are content-addressed and branches independent, heavy final renders can be offloaded to
remote workers (cloud-render plugin, Phase 7); the local cache stays authoritative.
