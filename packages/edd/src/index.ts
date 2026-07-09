/**
 * @openvideo/edd — the Edit Decision Document (Video AST) contract.
 *
 * Public surface: types, the validation pass, the lowering pass (EDD -> IR), and the IR types.
 * Every other OpenVideo package depends on this one (PRD §12, §13; CLAUDE.md invariants).
 */

export type * from "./types.ts";
export type * from "./ir.ts";
export { validateEDD, isRenderable } from "./validate.ts";
export { lowerEDD, LoweringError } from "./lower.ts";
