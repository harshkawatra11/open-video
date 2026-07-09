/** @openvideo/project — workspace, media ingest+probe, EDD scaffold/persist/version (PRD §17). */

export { probeMedia } from "./probe.ts";
export { scaffoldEdd } from "./scaffold.ts";
export type { ScaffoldOptions } from "./scaffold.ts";
export {
  createProject,
  openProject,
  ingestAsset,
  sourcesMap,
  readManifest,
  addLibraryAsset,
  saveEdd,
  loadEdd,
} from "./project.ts";
export type { ProjectRef, ManifestEntry, CreateProjectOptions, LibraryAssetMeta } from "./project.ts";
