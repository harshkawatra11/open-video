/**
 * OpenVideo MCP server — shared context (mirrors the daemon's env conventions, PRD §8.6/§23). This
 * process is spawned by the Claude CLI (per `--mcp-config`), not by the daemon directly, so it
 * re-derives WORKDIR/PROJECTS_DIR/keystore from the same env vars rather than sharing daemon state.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createDefaultRegistry, openKeystore, type ProviderRegistry } from "@openvideo/library";

export interface McpContext {
  workdir: string;
  projectsDir: string;
  registry: ProviderRegistry;
}

export function createContext(): McpContext {
  const workdir = process.env.OPENVIDEO_WORKDIR ?? path.join(os.homedir(), ".openvideo", "work");
  const projectsDir = path.join(workdir, "projects");
  const keystoreDir = path.join(workdir, "keystore");
  fs.mkdirSync(projectsDir, { recursive: true });
  const keystore = openKeystore(keystoreDir);
  const registry = createDefaultRegistry({ resolveKey: (id) => keystore.get(id) });
  return { workdir, projectsDir, registry };
}
