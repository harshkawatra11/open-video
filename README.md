# OpenVideo

An AI-native, intent-first, programmable video-editing operating system. You describe intent in
natural language; a Claude-powered multi-agent system plans, compiles, and renders the result. Every
edit is structured data — a versioned **Edit Decision Document (EDD / Video AST)** — before it
renders.

> **Status:** early implementation. The authoritative design lives in
> [`PRODUCT_REQUIREMENTS_DOCUMENT.txt`](./PRODUCT_REQUIREMENTS_DOCUMENT.txt) and
> [`docs/`](./docs/00-INDEX.md). Read [`CLAUDE.md`](./CLAUDE.md) before contributing — it captures
> the invariants every change must honor.

## Architecture in one breath

Electron + Next.js **cockpit** over a single privileged Node **daemon** that **spawns the Claude CLI
headless** (reasoning) and runs FFmpeg / Whisper / Remotion / yt-dlp (deterministic tools). Editing
is compilation: intent → plan → EDD → IR → execution DAG → render. See `docs/04-system-architecture.md`.

## Monorepo layout (pnpm)

```
apps/      cockpit (Electron+Next.js) · daemon (privileged service)   [planned]
packages/  edd · compiler · render · mcp-server · cli-adapter · installer · agents · remotion · shared
plugins/   first-party plugins                                         [planned]
docs/      architecture set (start at docs/00-INDEX.md)
```

## Develop

Requires Node >= 24 and pnpm. Node 24 runs the TypeScript sources directly (native type-stripping),
so the foundational packages test with no build step:

```sh
pnpm -r test        # run all package tests
# or per package:
node --test packages/edd/test/*.test.ts
```

`packages/edd` is the contract every other package depends on — start there.

## License

Apache-2.0.
