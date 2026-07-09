/** @openvideo/shared — protocol contracts, ids, and the terminal mapping. */

export * from "./ids.ts";
export type * from "./protocol.ts";
export { isEvent, isRequest } from "./protocol.ts";
export { friendlyTerminalLine, friendlyToolLine } from "./terminal.ts";
