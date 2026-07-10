/** @openvideo/workspace-template — scaffold + install a vlawgish-style edit workspace (thin-wrapper pivot, ADR-0014). */

export { scaffoldWorkspace } from "./scaffold.ts";
export type { ScaffoldWorkspaceOptions, ScaffoldWorkspaceResult } from "./scaffold.ts";
export { installRemotionDeps } from "./install.ts";
export type { InstallProgress } from "./install.ts";
export { trustWorkspace } from "./trust.ts";
export { renderThemeTs, DEFAULT_BRAND } from "./theme.ts";
export type { BrandKit } from "./theme.ts";
