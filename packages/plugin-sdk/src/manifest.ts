/**
 * OpenVideo — plugin manifest contract (doc 15, Appendix D §9). `openvideo.json` describes a
 * plugin's identity, capabilities, permissions, params, and dependencies; the daemon/agents discover
 * and load plugins purely from this file, never by guessing at a folder's contents.
 */

export type PluginType =
  | "agent"
  | "skill"
  | "caption-style"
  | "transition"
  | "template"
  | "animation-pack"
  | "look-system"
  | "renderer"
  | "music-provider"
  | "importer"
  | "cloud-render";

export const PLUGIN_TYPES: readonly PluginType[] = [
  "agent",
  "skill",
  "caption-style",
  "transition",
  "template",
  "animation-pack",
  "look-system",
  "renderer",
  "music-provider",
  "importer",
  "cloud-render",
];

export interface PluginDependency {
  tool: string;
  min?: string;
}

export interface PluginManifest {
  name: string;
  version: string;
  type: PluginType;
  /** Path (relative to the manifest) to the entry module. */
  entry: string;
  /** e.g. "edd:patch", "remotion:component", "render:engine", "net:fetch". */
  capabilities: string[];
  /** e.g. "fs:project-read", "fs:project-write", "net:proxy". */
  permissions: string[];
  params?: Record<string, unknown>;
  dependencies?: PluginDependency[];
  preview?: string;
  license: string;
}

export interface ManifestDiagnostic {
  code: string;
  message: string;
}

/** Validates a parsed manifest against the doc 15 / Appendix D §9 contract. Pure — no filesystem
 *  access, so it's testable against arbitrary JSON without a real plugin directory. */
export function validateManifest(m: unknown): ManifestDiagnostic[] {
  const d: ManifestDiagnostic[] = [];
  if (!m || typeof m !== "object") return [{ code: "PLUGIN000", message: "manifest is not an object" }];
  const manifest = m as Record<string, unknown>;

  if (!manifest.name || typeof manifest.name !== "string") {
    d.push({ code: "PLUGIN001", message: "missing or invalid 'name'" });
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    d.push({ code: "PLUGIN002", message: "missing or invalid 'version'" });
  }
  if (!PLUGIN_TYPES.includes(manifest.type as PluginType)) {
    d.push({ code: "PLUGIN003", message: `'type' must be one of ${PLUGIN_TYPES.join(", ")}, got ${JSON.stringify(manifest.type)}` });
  }
  if (!manifest.entry || typeof manifest.entry !== "string") {
    d.push({ code: "PLUGIN004", message: "missing or invalid 'entry'" });
  }
  if (manifest.capabilities !== undefined && !Array.isArray(manifest.capabilities)) {
    d.push({ code: "PLUGIN005", message: "'capabilities' must be an array" });
  }
  if (manifest.permissions !== undefined && !Array.isArray(manifest.permissions)) {
    d.push({ code: "PLUGIN006", message: "'permissions' must be an array" });
  }
  if (!manifest.license || typeof manifest.license !== "string") {
    d.push({ code: "PLUGIN007", message: "missing or invalid 'license'" });
  }
  return d;
}

export function isValidManifest(m: unknown): m is PluginManifest {
  return validateManifest(m).length === 0;
}
