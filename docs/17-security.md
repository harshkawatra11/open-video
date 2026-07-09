# 17 — Security

> Expands PRD §23. Local-first; daemon is the sole privileged process; sandboxed renderer + plugins;
> SSRF-guarded proxy (ADR-0008).

## Threat model
Malicious/buggy plugin (fs/net/code abuse); prompt-injection via imported media/metadata/transcripts
steering harmful tool calls; SSRF via the outbound proxy; secret leakage; accidental destructive
actions; supply-chain compromise of bundled tools/deps.

## Privilege model
The **daemon is the only privileged process** (fs, process spawn, network). The renderer is sandboxed
(contextIsolation on, nodeIntegration off) and acts only through a typed preload bridge. A compromised
renderer or plugin cannot act on the system directly. (open-design model.)

## Tool sandboxing
Media tools run as child processes with constrained, typed args (never raw model-authored shell for
privileged actions), captured output, timeouts, working dir pinned to the project sandbox, no
inherited secrets. A constrained bash tool MAY exist for breadth, but hard-to-reverse actions are
promoted to dedicated gated tools (so the harness can intercept/audit).

## Plugin sandboxing & permissions
Untrusted plugin code → worker/VM boundary, no ambient fs/net. Manifest-declared capabilities/
permissions enforced by the daemon; high-risk capabilities need explicit consent; network via the
SSRF-guarded proxy.

## Permission system
Hard-to-reverse actions (overwrite deliverable, delete assets, network import, install software, run a
privileged plugin capability) gated per the permission mode; inline, specific cockpit prompts;
per-policy memory. Mirrors Claude Code permission modes.

## Secrets
Provider keys (for optional plugins) in an OS-keychain-backed encrypted keystore — never in the EDD,
prompts, logs, or project files; injected by the daemon at call time, not exposed to renderer/agents/
plugin sandboxes. The Claude CLI manages its own subscription auth; OpenVideo does not store the
user's Claude credentials.

## Network & SSRF
Default offline. Any outbound request (model-weight download, authorized import, plugin provider call)
goes through the daemon proxy with SSRF protection (block private/loopback/link-local; validate
redirects; allowlist where possible) — the open-design BYOK-proxy pattern.

## Filesystem protection
All file ops validated against the project sandbox (path normalization, no traversal, no symlink
escape); writes outside project/app-data dirs refused; targets inspected + gated before overwrite/
delete.

## Supply chain & privacy
Bundled tools/deps pinned + integrity-checked; registry plugins signature-verified on install.
Footage/project data never leave the machine unless the user opts into a networked feature; telemetry
opt-in and never includes media (PRD §25.4).

## Prompt-injection posture
Treat imported media text/metadata/transcripts as untrusted; privileged actions are gated tools, not
free shell; the permission system is the backstop.
