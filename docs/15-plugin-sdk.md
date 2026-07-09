# 15 — Plugin SDK & Ecosystem

> Expands PRD §20. Skills/agents/styles/templates/renderers are plain files anyone can author and
> share (open-design model). Manifest: Appendix D §9.

## Plugin types
agent/skill · caption-style · transition · template · animation-pack · look-system (STYLE.md pack) ·
renderer (alt engine, e.g. HyperFrames) · music/SFX provider · importer · cloud-render.

## Manifest (`openvideo.json`)
```
{ name, version, type, entry,
  capabilities[],   // "edd:patch","remotion:component","render:engine","net:fetch", ...
  permissions[],    // "fs:project-read","fs:project-write","net:proxy", ...
  params{},         // apply-time configuration
  dependencies[]:{tool,min},  // provisioned by the Installation Agent (tiered)
  preview, license }
```

## Lifecycle
discover (registry/local) → install (verify signature/manifest; provision declared deps) → load
(register capabilities with the daemon/MCP) → run (invoked by agents or the user) → sandbox (least
privilege).

## Capabilities & permissions (sandboxing — see `17-security.md`)
A plugin declares the capabilities it needs; the daemon enforces them. Untrusted plugin code runs in
a worker/VM boundary with no ambient fs/network; network goes through the SSRF-guarded proxy;
high-risk capabilities require explicit user consent.

## Distribution
A community registry/marketplace (open-design model) with manifests, previews, one-click install;
plugins are plain folders, so they're also shareable as files or via git.

## Authoring example (caption-style)
Ship a Remotion component + `openvideo.json` (type `caption-style`, capability `remotion:component`,
params for color/size/highlight) + a preview. The Caption agent discovers it via `/capabilities`;
the user selects it ("use the neon caption style"); lowering resolves its params against STYLE.md.

## API stability (PRD §21.5)
The Edit/Session protocol, MCP tool contract, EDD schema, and plugin manifest are versioned with
deprecation policies so the ecosystem can rely on them.
