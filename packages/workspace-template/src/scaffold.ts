/**
 * OpenVideo — scaffold a per-project video-edit workspace (vlawgish-style).
 *
 * Unlike the EDD scaffold, this does not produce a typed timeline for the agent to patch — it
 * produces a *workspace* (source video, PRD, craft CLAUDE.md, a Remotion skeleton) that a headless
 * Claude Code session edits with full Bash/Write freedom, the same way vlawgish-edit works.
 */

import { cp, mkdir, readFile, writeFile, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderThemeTs, type BrandKit } from "./theme.ts";
import { trustWorkspace } from "./trust.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, "..", "template");

export interface ScaffoldWorkspaceOptions {
  /** Absolute path to the new project workspace directory. Must not already exist. */
  projectDir: string;
  /** Absolute path to the source video to ingest. Copied in as source.<ext>. */
  sourceVideoPath: string;
  /** The brief for this edit — written verbatim to PRD.md. */
  prd: string;
  /** Brand kit inputs (colors, fonts, on-screen-talent/tone context, emphasis terms). */
  brand: BrandKit;
  /** Optional transcript text (with or without timestamps) — written to transcript.txt if given. */
  transcript?: string;
  /** Optional path to a global craft-learnings file (see memory/craft-learnings.txt) seeded into
   *  this workspace's memory/ so accumulated craft knowledge carries forward. */
  globalLearningsPath?: string;
  /** Override for trustWorkspace()'s config file — defaults to the real ~/.claude.json. Exists so
   *  tests don't mutate a developer's actual Claude Code config (see trust.ts). */
  claudeConfigPath?: string;
}

export interface ScaffoldWorkspaceResult {
  projectDir: string;
  claudeMdPath: string;
  prdPath: string;
  sourcePath: string;
  remotionDir: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

function fillTemplate(text: string, brandContext: string): string {
  return text.replace(/\{\{BRAND_CONTEXT\}\}/g, brandContext);
}

/** Scaffold a new workspace directory. Does NOT run `pnpm install` — call installRemotionDeps() separately. */
export async function scaffoldWorkspace(opts: ScaffoldWorkspaceOptions): Promise<ScaffoldWorkspaceResult> {
  const { projectDir, sourceVideoPath, prd, brand, transcript, globalLearningsPath, claudeConfigPath } = opts;

  if (await exists(projectDir)) {
    throw new Error(`Workspace already exists: ${projectDir} (name workspaces up front; do not scaffold into an existing dir)`);
  }

  await mkdir(projectDir, { recursive: true });
  await mkdir(path.join(projectDir, "work"), { recursive: true });
  await mkdir(path.join(projectDir, "out"), { recursive: true });
  await mkdir(path.join(projectDir, "memory"), { recursive: true });

  // CLAUDE.md — parameterized craft doc
  const claudeMdTemplate = await readFile(path.join(TEMPLATE_DIR, "CLAUDE.md"), "utf8");
  const claudeMd = fillTemplate(claudeMdTemplate, brand.brandContext);
  const claudeMdPath = path.join(projectDir, "CLAUDE.md");
  await writeFile(claudeMdPath, claudeMd, "utf8");

  // PRD + optional transcript
  const prdPath = path.join(projectDir, "PRD.md");
  await writeFile(prdPath, prd, "utf8");
  if (transcript) {
    await writeFile(path.join(projectDir, "transcript.txt"), transcript, "utf8");
  }

  // Source video — preserve original extension
  const ext = path.extname(sourceVideoPath) || ".mp4";
  const sourcePath = path.join(projectDir, `source${ext}`);
  await copyFile(sourceVideoPath, sourcePath);

  // Remotion skeleton
  const remotionDir = path.join(projectDir, "remotion");
  await cp(path.join(TEMPLATE_DIR, "remotion"), remotionDir, { recursive: true });
  await writeFile(path.join(remotionDir, "src", "theme.ts"), renderThemeTs(brand), "utf8");

  // work/ scaffold (gen_captions.cjs pattern)
  await cp(path.join(TEMPLATE_DIR, "work"), path.join(projectDir, "work"), { recursive: true });

  // memory/ — seed with accumulated craft learnings, if any
  const learningsDest = path.join(projectDir, "memory", "learnings.txt");
  if (globalLearningsPath && (await exists(globalLearningsPath))) {
    const seed = await readFile(globalLearningsPath, "utf8");
    await writeFile(learningsDest, seed, "utf8");
  } else {
    await writeFile(learningsDest, "# Learnings for this workspace\n\n(No prior craft-learnings.txt found to seed from.)\n", "utf8");
  }

  // .claude/settings.json — allowlist the tools this workflow needs so a headless run doesn't
  // stall on permission prompts for ffmpeg/whisper/pnpm/npx remotion.
  //
  // RULE SYNTAX GOTCHA #1 (confirmed via a real headless run that silently produced zero output
  // for 45+ minutes): the permission-rule grammar is `Bash(<prefix> *)` — a literal space before
  // the trailing `*` wildcard — NOT `Bash(<prefix>:*)`. The colon form matches nothing, every
  // Bash call then needs interactive approval that never arrives headless, and Claude quietly
  // retries variations forever instead of failing loudly.
  //
  // RULE SYNTAX GOTCHA #2 (confirmed via a second real headless run: it wrote a fully correct
  // run_edit.ps1 — right two-pass loudnorm, right PNG-sequence render, right frame-padding
  // detection, right overlay composite — then stopped and told the user to run it manually,
  // because it invoked those commands through the *PowerShell* tool, not Bash. On Windows,
  // Claude Code exposes both a Bash tool and a PowerShell tool, and each needs its own allow
  // rule — a `Bash(ffmpeg *)` rule does NOT cover a `PowerShell(ffmpeg ...)` call). Allowlist
  // every command under both tool prefixes rather than assuming which one the agent will pick.
  // Verify against a real ~/.claude/settings.json if this ever needs to change.
  await mkdir(path.join(projectDir, ".claude"), { recursive: true });
  const COMMAND_PREFIXES = [
    "ffmpeg",
    "ffprobe",
    "whisper",
    "pnpm",
    "npx remotion",
    "npx --yes remotion",
    "node",
    "ls",
    "mkdir",
    "robocopy",
    "Get-ChildItem",
    "Set-Location",
  ];
  const settings = {
    permissions: {
      allow: COMMAND_PREFIXES.flatMap((p) => [`Bash(${p} *)`, `PowerShell(${p} *)`]),
    },
  };
  await writeFile(path.join(projectDir, ".claude", "settings.json"), JSON.stringify(settings, null, 2), "utf8");

  // Without this, .claude/settings.json above is silently ignored — see trust.ts.
  await trustWorkspace(projectDir, claudeConfigPath);

  return { projectDir, claudeMdPath, prdPath, sourcePath, remotionDir };
}
