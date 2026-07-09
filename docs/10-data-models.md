# 10 — Data Models

> Expands PRD §13. Authoritative JSON shapes live in Appendix D; types/validators in `packages/edd`
> and `packages/shared`. All models carry `schemaVersion` and are git-versioned.

## The model set
| Model | File (per project) | Role |
|-------|--------------------|------|
| Project manifest | `project.json` | identity, dimensions, platform, refs |
| EDD (Video AST) | `timelines/<id>.edd.json` | the edit, declaratively (the AST) |
| Transcript | `transcripts/<asset>.json` | ASR text + segment/word timings (authoritative) |
| Blueprint/Plan | `plans/<id>.plan.json` | approved creative blueprint |
| STYLE (look) | `STYLE.md` | brand/look system (open-design DESIGN.md analog) |
| Asset manifest | `assets/manifest.json` | assets + content hashes + probe metadata |
| Cache index | `cache/index.json` | content-addressed render-node cache |
| Memory | `memory/*.md` | agent/project memory facts |
| Render record | `renders/<id>.json` | provenance: EDD ver, tool vers, outputs |

## EDD (the heart)
See Appendix D §1 + PRD §13.2 for the full worked example. Key properties: intent-bearing (holds
high-level directives resolved at lowering), provenance per node (which agent + why), diffable,
patch-as-commit. Invariants enforced by the validation pass (monotonic times, resolvable refs,
in/out bounds, caption safe-margins, sane export).

## Transcript
Authoritative text may override raw ASR (PoC F4); romanization applied by the Caption agent while
preserving timings (PoC F5). Carries model + device used (provenance for reproducibility).

## STYLE (look system)
Per-project (or shared) file constraining every output. Sections: identity/voice; palette;
typography; caption style; motion language; pacing; audio targets; grade defaults; b-roll policy;
anti-patterns. Authored by the user, derived from a reference, or shipped as a plugin. Full section
schema: Appendix D §8; design detail: `14-style-and-design-system.md`.

## Asset manifest + cache index
Assets identified by sha256 (dedupe + reproducibility); proxies keyed off source hash in `cache/`.
`cacheKey = hash(op + resolvedInputs + params + toolVersions)`.

## Versioning
schemaVersion on every model; explicit migrations; EDD/plan/STYLE/transcript git-committed on each
applied change (edit-as-commit → diff/blame/rollback/reproducibility). Large binaries git-ignored or
LFS-pointer'd; durable versioned state is the small JSON/markdown + content hashes.
