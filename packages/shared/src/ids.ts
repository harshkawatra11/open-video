/** Prefixed, sortable-ish ids for OpenVideo entities (project/session/job/edd/...). */
import { randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function hasPrefix(id: string, prefix: string): boolean {
  return id.startsWith(prefix + "_");
}
