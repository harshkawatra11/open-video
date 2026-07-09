/**
 * OpenVideo — plugin discovery + loading (doc 15 lifecycle: discover -> install -> load -> run ->
 * sandbox). This is the "discover" and "load" halves for FIRST-PARTY, trusted plugins only.
 *
 * HONEST GAP: doc 15/17 call for untrusted plugin code to run inside a worker/VM boundary with no
 * ambient fs/network access. That sandbox is NOT implemented here — `loadPlugin` does a plain dynamic
 * `import()` of the entry module with full ambient access, same as any other first-party package.
 * This is acceptable for plugins the user/repo author ships (like the flagship reel-pipeline plugin)
 * but is NOT safe to point at arbitrary third-party plugin directories yet. Flagged here rather than
 * silently pretending sandboxing exists.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateManifest, isValidManifest } from "./manifest.ts";
import type { PluginManifest } from "./manifest.ts";

export interface DiscoveredPlugin {
  manifest: PluginManifest;
  dir: string;
}

export interface PluginDiscoveryError {
  dir: string;
  errors: string[];
}

export interface DiscoveryResult {
  plugins: DiscoveredPlugin[];
  errors: PluginDiscoveryError[];
}

/** Scans `pluginsDir` for immediate subdirectories containing a valid `openvideo.json`. Invalid or
 *  missing manifests are reported as errors, never silently skipped — a broken plugin should be
 *  visible, not invisible. */
export function discoverPlugins(pluginsDir: string): DiscoveryResult {
  const plugins: DiscoveredPlugin[] = [];
  const errors: PluginDiscoveryError[] = [];

  if (!fs.existsSync(pluginsDir)) return { plugins, errors };

  for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(pluginsDir, entry.name);
    const manifestPath = path.join(dir, "openvideo.json");
    if (!fs.existsSync(manifestPath)) {
      errors.push({ dir, errors: ["no openvideo.json found"] });
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    } catch (e) {
      errors.push({ dir, errors: [`invalid JSON: ${(e as Error).message}`] });
      continue;
    }
    const diagnostics = validateManifest(parsed);
    if (diagnostics.length > 0) {
      errors.push({ dir, errors: diagnostics.map((d) => `${d.code}: ${d.message}`) });
      continue;
    }
    if (isValidManifest(parsed)) plugins.push({ manifest: parsed, dir });
  }

  return { plugins, errors };
}

/** Dynamically imports a discovered plugin's entry module. Real `import()` — this is the "load" step
 *  of the doc 15 lifecycle; "run" is up to the caller (invoking whatever the entry module exports). */
export async function loadPlugin(plugin: DiscoveredPlugin): Promise<Record<string, unknown>> {
  const entryPath = path.resolve(plugin.dir, plugin.manifest.entry);
  if (!fs.existsSync(entryPath)) {
    throw new Error(`plugin "${plugin.manifest.name}": entry "${plugin.manifest.entry}" not found at ${entryPath}`);
  }
  return import(pathToFileURL(entryPath).href);
}
