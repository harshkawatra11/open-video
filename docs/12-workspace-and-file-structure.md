# 12 — Workspace & File Structure

> Expands PRD §17. Self-contained, portable, git-backed projects; one privileged app data dir.

## Application-level (per user)
```
<user data>/OpenVideo/
  config/        settings, hardware/capability profile, control defaults
  secrets/       encrypted keystore (OS keychain backed) — never in projects/logs
  models/        downloaded model weights (Whisper, packs) — shared
  cache-global/  optional cross-project content-addressed cache
  plugins/       installed plugins
  logs/          app + daemon logs, diagnostics
  projects/      all user projects
```

## Per-project (git repository)
```
projects/<project>/
  project.json    identity + dimensions + platform + refs
  STYLE.md        look/brand system
  assets/         source media + manifest.json (hash + probe)      [INPUT, immutable]
  downloads/      sandboxed imports pending promotion              [INPUT, quarantine]
  transcripts/    ASR + timings (authoritative)                    [DERIVED]
  plans/          approved creative blueprints                     [PLAN]
  timelines/      the EDD(s) — the Video AST(s)                    [AST, the heart]
  agents/         project-local agent/skill overrides              [CONFIG]
  prompts/        prompt history                                   [HISTORY]
  memory/         project memory (style decisions, critiques)      [MEMORY]
  plugins/        project-local plugins                            [EXT]
  models/         pinned model references                          [REF]
  cache/          content-addressed render cache + proxies + index [CACHE, regenerable]
  renders/        intermediate/preview renders + render records    [OUTPUT]
  exports/        final deliverables                               [OUTPUT]
  versions/       human-named snapshots on top of git              [HISTORY]
  backups/        periodic safety backups                          [SAFETY]
  logs/           per-project logs                                 [OPS]
```
Purpose of each directory: see PRD §17.2 (every folder explained).

## Versioning model
Project = git repo. Each applied edit commits the changed EDD/plan/STYLE/transcript with an
agent-attributed message (from provenance) → diff/blame/rollback/branching/reproducibility for free.
Large binaries git-ignored or LFS-pointer'd; durable state is the small JSON/markdown + content
hashes. `versions/` adds human-named checkpoints for non-technical recall.

## Asset hashing
sha256 identity per asset → dedupe + reproducible cache keys; proxies in `cache/` keyed off source
hash; deleting `cache/` never loses real data.

## Portability
A project dir is self-contained (assets + EDD + STYLE + history); zip/clone to move the whole
reproducible edit; cache/renders need not travel.
