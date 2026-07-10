/**
 * OpenVideo — pre-trust a scaffolded workspace with the Claude CLI.
 *
 * Real, confirmed-in-the-wild root cause of every headless edit session silently having its
 * ffmpeg/ffprobe Bash calls blocked (across three separate real runs, even after fixing the
 * .claude/settings.json rule syntax twice): the CLI has a *separate* per-directory "trust" gate
 * from the permissions allowlist. A directory a human has never opened Claude Code in
 * interactively is untrusted, and an untrusted directory's .claude/settings.json permission rules
 * are silently ignored entirely — confirmed via `claude -p ... --output-format json`, whose first
 * stderr line was:
 *   "Ignoring 24 permissions.allow entries from .claude/settings.json: this workspace has not
 *   been trusted. Run Claude Code interactively here once and accept the trust dialog, or set
 *   projects["<dir>"].hasTrustDialogAccepted: true in ~/.claude.json."
 * Every scaffolded workspace is a brand-new directory nobody has opened interactively, so this
 * fires every time — the settings.json rule-syntax fixes were real bugs, but this is the actual
 * reason a headless session never got past permission prompts in practice. Follow the CLI's own
 * suggested fix: write the trust flag into ~/.claude.json's projects map ourselves at scaffold
 * time, the same way accepting the interactive dialog once would.
 */

import { readFile, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const CLAUDE_JSON_PATH = path.join(os.homedir(), ".claude.json");

/** ~/.claude.json's project keys use forward slashes even on Windows (confirmed against real
 *  entries already in the file, e.g. "C:/Users/harsh") — normalize to match. */
function toProjectKey(dir: string): string {
  return path.resolve(dir).replace(/\\/g, "/");
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Marks `workspaceDir` as trusted in `configPath` (defaults to the real ~/.claude.json — the
 *  literal file the CLI reads, not overridable by env var), merging into whatever's already there
 *  rather than overwriting it (other projects' entries, global settings, etc. must survive
 *  untouched). `configPath` exists so tests can point at a throwaway file instead of the real one —
 *  mutating a developer's actual ~/.claude.json from a test is not acceptable, especially since
 *  that file may be concurrently read/written by their own live Claude Code session. */
export async function trustWorkspace(workspaceDir: string, configPath: string = CLAUDE_JSON_PATH): Promise<void> {
  const key = toProjectKey(workspaceDir);
  let root: Record<string, unknown> = {};
  if (await exists(configPath)) {
    try {
      root = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    } catch {
      // A corrupt ~/.claude.json is not this function's problem to fix — bail rather than clobber
      // whatever's there. The scaffolded workspace will just fall back to needing manual trust.
      return;
    }
  }
  const projects = (root.projects as Record<string, Record<string, unknown>> | undefined) ?? {};
  projects[key] = { ...(projects[key] ?? {}), hasTrustDialogAccepted: true };
  root.projects = projects;
  await writeFile(configPath, JSON.stringify(root, null, 2), "utf8");
}
