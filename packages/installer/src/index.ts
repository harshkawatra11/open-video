/** @openvideo/installer — tiered install planning + hardware profiling (ADR-0004, PRD §10). */

export type * from "./catalog.ts";
export { CATALOG, CAPABILITY_DEPS } from "./catalog.ts";
export type { HardwareProfile } from "./profile.ts";
export { currentOs, parseGpu, parseVersion, baseProfile } from "./profile.ts";
export type { InstallItem, InstallPlan } from "./plan.ts";
export { planInstall } from "./plan.ts";
