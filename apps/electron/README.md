# @openvideo/electron

The Electron shell (ADR-0001). Run it with:

```
pnpm --filter @openvideo/electron start
```

## What it does

`src/main.js` spawns the daemon via `ELECTRON_RUN_AS_NODE=1` (Electron's own bundled binary acting as
a plain Node interpreter — a packaged app needs no separate Node.js install), waits for `/health`, then
opens a `BrowserWindow` pointed at the daemon's served UI. The renderer has `nodeIntegration: false` and
`sandbox: true` — it has no privileged access; only the daemon does (ADR-0008).

## Verified

Launched the real `electron.exe` (not `npx electron`/a `.cmd` shim — same class of Windows binary-
resolution care as `cli-adapter`'s `resolveClaudeBin`), confirmed it spawned a real daemon child process
that became healthy, and confirmed the daemon served real HTML on that port.

## Packaging (skeleton only, NOT run)

`package.json`'s `build` field is a real `electron-builder` config (Windows NSIS target, bundling the
daemon source + the static cockpit as extra resources) — but `pnpm --filter @openvideo/electron package`
has **not been run** in this session. Packaging + code-signing + auto-update infrastructure (doc 19) is
real, non-trivial work (signing certs, an update feed, a CI release pipeline) that's out of scope for a
dev-environment build pass; the config exists so the shape is right when that infra is set up, not as a
claim that a signed installer has been produced.

## Known scope limit (documented, not silently half-wired)

It currently loads the daemon's **static cockpit fallback** (`apps/cockpit/public`), not the full
Next.js Studio app. Studio has dynamic routes (`/studio/[id]`) that need its own server — pointing
Electron at it requires either a daemon-served static Studio export or a second managed `next start`
process. Both are real follow-up work, not attempted here to avoid a half-working integration.
