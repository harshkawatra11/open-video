# ADR-0008: Local-first; the daemon is the sole privileged process; SSRF-guarded proxy

- **Status:** Accepted
- **Related:** PRD §2.3, §8, §23; open-design security model

## Context
Creators handle unreleased/sensitive footage; privacy matters. The system runs untrusted-ish
inputs (imported media/metadata that could carry prompt-injection) and will eventually run
third-party plugins. We need a security posture that contains blast radius and keeps data local.

## Options considered
1. **Local-first + single privileged daemon + sandboxed renderer + SSRF-guarded proxy** — only the
   daemon touches fs/processes/network; the renderer and plugins are sandboxed; outbound requests
   are proxied with SSRF protection; footage never leaves the machine unless the user opts in. The
   open-design model.
2. **Privileged renderer** (nodeIntegration on) — simpler IPC. Con: unacceptable blast radius; a
   compromised renderer/plugin acts directly on the system.
3. **Cloud-first** — managed convenience. Con: footage egress by default; privacy cost; offline
   unusable.

## Decision
**Local-first with a single privileged daemon and a sandboxed renderer.** All outbound traffic goes
through an SSRF-guarded proxy. Secrets live in an OS-keychain-backed encrypted keystore. Plugins run
under least privilege with declared, enforced capabilities. Cloud features are opt-in and later.

## Rationale
Best privacy for the target users, smallest blast radius, and direct reuse of open-design's proven
security primitives. Determinism and offline capability are bonuses.

## Consequences
- Positive: privacy by default; contained blast radius; offline-capable.
- Negative: more IPC ceremony (renderer can't act directly); proxy/permission machinery to build.
- Mitigations: a typed preload bridge; capability/permission model; reuse open-design patterns.

## Revisit when
A cloud/collaboration phase requires a hybrid trust model (extend, don't replace, the local-first
core).
