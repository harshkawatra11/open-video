/**
 * OpenVideo — tiered install planning (ADR-0004, PRD §10.4).
 *
 * Given a capability the workflow needs and the hardware profile, decide exactly what to install:
 * resolve the torch variant by GPU, drop NVIDIA-only deps on non-NVIDIA machines, skip what's
 * already present, and flag whether consent is required (any heavy item) plus the total download.
 */

import { CATALOG, CAPABILITY_DEPS } from "./catalog.ts";
import type { Dep, Method, Tier } from "./catalog.ts";
import type { HardwareProfile } from "./profile.ts";

export interface InstallItem {
  id: string;
  tier: Tier;
  method: Method;
  approxMB: number;
  purpose: string;
}

export interface InstallPlan {
  capability: string;
  items: InstallItem[];
  /** true if any item is heavy → ask the user before downloading (ADR-0004). */
  needsConsent: boolean;
  totalMB: number;
}

function resolveDepId(logical: string, profile: HardwareProfile): string {
  if (logical === "torch") return profile.gpu.nvidia ? "torch-cuda" : "torch-cpu";
  return logical;
}

function isInstalled(dep: Dep, profile: HardwareProfile): boolean {
  const key = dep.toolKey ?? dep.id;
  return profile.tools[key] != null || profile.tools[dep.id] != null;
}

function methodFor(dep: Dep, profile: HardwareProfile): Method {
  return dep.methods?.[profile.os] ?? "bundled";
}

export function planInstall(capability: string, profile: HardwareProfile): InstallPlan {
  const logicals = CAPABILITY_DEPS[capability];
  if (!logicals) throw new Error(`unknown capability "${capability}"`);

  const items: InstallItem[] = [];
  const seen = new Set<string>();

  for (const logical of logicals) {
    const depId = resolveDepId(logical, profile);
    if (seen.has(depId)) continue;
    seen.add(depId);
    const dep = CATALOG[depId];
    if (!dep) continue;
    if (dep.requiresNvidia && !profile.gpu.nvidia) continue; // skip GPU-only deps on non-NVIDIA
    if (isInstalled(dep, profile)) continue;
    items.push({
      id: dep.id,
      tier: dep.tier,
      method: methodFor(dep, profile),
      approxMB: dep.approxMB,
      purpose: dep.purpose,
    });
  }

  return {
    capability,
    items,
    needsConsent: items.some((i) => i.tier === "heavy"),
    totalMB: items.reduce((s, i) => s + i.approxMB, 0),
  };
}
