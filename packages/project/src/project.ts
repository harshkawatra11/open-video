/**
 * OpenVideo — project workspace (PRD §17). Self-contained, git-backed project directories with
 * media ingest, a manifest, and EDD persistence + version snapshots.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { resolveBin } from "@openvideo/render";
import type { EDD, Probe, Source } from "@openvideo/edd";

const SUBDIRS = ["assets", "downloads", "timelines", "cache", "renders", "exports", "transcripts", "plans", "memory", "versions", "logs"];

const DEFAULT_STYLE = `# STYLE.md — OpenVideo look system

identity: clean, premium, trustworthy
palette: { bg: "#0E1C2B", fg: "#FFFFFF", accent: "#C9A227" }
typography: { display: "Anton", body: "Inter" }
caption: { size: 64, weight: 800, emphasisTreatment: "uppercase + accent + glow", safeMarginPx: 120, position: "lower-third (off eyeline)" }
motion: { punchInAmplitude: 0.03, durationsMs: [200, 400], eases: ["io"] }
pacing: { maxStaticFrameS: 4 }
audio: { targetLUFS: -14, truePeakDb: -1.5 }
grade: { defaults: "tonemap HLG->Rec.709 + light grade", antiPatterns: ["teal-orange", "captions over eyeline"] }
broll: { policy: "generated / licensed / royalty-free only — never scrape" }
`;

export interface ProjectRef {
  id: string;
  dir: string;
}

export interface ManifestEntry {
  id: string;
  path: string; // relative to project dir, e.g. "assets/<hash>.mp4"
  hash: string;
  probe?: Probe;
  /** Set for library-sourced assets (doc 24 §7) — absent for user-ingested footage. */
  origin?: "user" | "provider" | "generated";
  providerId?: string;
  license?: string;
  attribution?: string;
}

export interface CreateProjectOptions {
  id?: string;
  name?: string;
  platform?: string;
}

function sha256File(p: string): string {
  return createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function git(dir: string, args: string[]): void {
  try {
    spawnSync(resolveBin("git"), ["-C", dir, ...args], { stdio: "ignore", windowsHide: true });
  } catch {
    /* git is best-effort versioning; never block on it */
  }
}

function commit(dir: string, msg: string): void {
  git(dir, ["add", "-A"]);
  git(dir, ["-c", "user.email=openvideo@local", "-c", "user.name=OpenVideo", "commit", "-q", "-m", msg]);
}

export function createProject(rootDir: string, opts: CreateProjectOptions = {}): ProjectRef {
  const id = opts.id ?? `prj_${Date.now().toString(36)}`;
  const dir = path.join(rootDir, id);
  for (const s of SUBDIRS) fs.mkdirSync(path.join(dir, s), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "project.json"),
    JSON.stringify(
      { id, name: opts.name ?? id, createdAt: new Date().toISOString(), platform: opts.platform ?? "instagram_reel", currentEdd: "timelines/main.edd.json", assets: "assets/manifest.json" },
      null,
      2,
    ),
  );
  if (!fs.existsSync(path.join(dir, "STYLE.md"))) fs.writeFileSync(path.join(dir, "STYLE.md"), DEFAULT_STYLE);
  const manifestPath = path.join(dir, "assets", "manifest.json");
  if (!fs.existsSync(manifestPath)) fs.writeFileSync(manifestPath, "[]");
  fs.writeFileSync(path.join(dir, ".gitignore"), "cache/\nrenders/\nexports/\n*.mp4\n*.mov\n*.wav\n!assets/**\n");
  git(dir, ["init", "-q"]);
  commit(dir, "init project");
  return { id, dir };
}

export function openProject(rootDir: string, id: string): ProjectRef {
  const dir = path.join(rootDir, id);
  if (!fs.existsSync(path.join(dir, "project.json"))) throw new Error(`no project "${id}" in ${rootDir}`);
  return { id, dir };
}

export function readManifest(dir: string): ManifestEntry[] {
  const p = path.join(dir, "assets", "manifest.json");
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as ManifestEntry[]) : [];
}

function writeManifest(dir: string, m: ManifestEntry[]): void {
  fs.writeFileSync(path.join(dir, "assets", "manifest.json"), JSON.stringify(m, null, 2));
}

/** Copy a media file into the project, hash + probe it, and record it in the manifest. */
export async function ingestAsset(proj: ProjectRef, srcPath: string): Promise<Source> {
  const { probeMedia } = await import("./probe.ts");
  const hash = sha256File(srcPath);
  const ext = path.extname(srcPath) || ".mp4";
  const name = `${hash.slice(0, 12)}${ext}`;
  const destAbs = path.join(proj.dir, "assets", name);
  if (!fs.existsSync(destAbs)) fs.copyFileSync(srcPath, destAbs);
  const probe = await probeMedia(destAbs);
  const rel = `assets/${name}`;
  const id = `src_${hash.slice(0, 12)}`;
  const manifest = readManifest(proj.dir).filter((e) => e.id !== id);
  manifest.push({ id, path: rel, hash: `sha256:${hash}`, probe });
  writeManifest(proj.dir, manifest);
  commit(proj.dir, `ingest ${name}`);
  return { id, path: rel, hash: `sha256:${hash}`, probe };
}

export interface LibraryAssetMeta {
  providerId: string;
  origin: "provider" | "generated";
  license: string;
  attribution?: string;
}

/** Record an already-fetched library asset (font/b-roll/music/sfx/image/look — doc 24 §7) into the
 *  project manifest with its provenance. Unlike `ingestAsset`, this does not ffprobe the file (most
 *  library assets aren't video) and never re-derives an id from content hash collision with footage. */
export function addLibraryAsset(proj: ProjectRef, srcPath: string, meta: LibraryAssetMeta): Source {
  const hash = sha256File(srcPath);
  const ext = path.extname(srcPath) || "";
  const name = `${meta.providerId}-${hash.slice(0, 12)}${ext}`;
  const destAbs = path.join(proj.dir, "assets", name);
  if (!fs.existsSync(destAbs)) fs.copyFileSync(srcPath, destAbs);
  const rel = `assets/${name}`;
  const id = `src_${hash.slice(0, 12)}`;
  const manifest = readManifest(proj.dir).filter((e) => e.id !== id);
  manifest.push({
    id,
    path: rel,
    hash: `sha256:${hash}`,
    origin: meta.origin,
    providerId: meta.providerId,
    license: meta.license,
    attribution: meta.attribution,
  });
  writeManifest(proj.dir, manifest);
  commit(proj.dir, `library: insert ${meta.providerId}/${name}`);
  return {
    id,
    path: rel,
    hash: `sha256:${hash}`,
    origin: meta.origin,
    providerId: meta.providerId,
    license: meta.license,
    attribution: meta.attribution,
  };
}

/** Absolute paths for every ingested source, keyed by source id (for the render executor). */
export function sourcesMap(proj: ProjectRef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of readManifest(proj.dir)) out[e.id] = path.join(proj.dir, e.path);
  return out;
}

export function saveEdd(proj: ProjectRef, edd: EDD): void {
  fs.writeFileSync(path.join(proj.dir, "timelines", "main.edd.json"), JSON.stringify(edd, null, 2));
  fs.writeFileSync(path.join(proj.dir, "versions", `${Date.now()}.edd.json`), JSON.stringify(edd, null, 2));
  commit(proj.dir, "update edd");
}

export function loadEdd(proj: ProjectRef): EDD | null {
  const p = path.join(proj.dir, "timelines", "main.edd.json");
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as EDD) : null;
}
