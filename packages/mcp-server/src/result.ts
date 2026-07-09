/** Small helpers so every tool returns MCP's `{ content: [{type:"text", ...}] }` shape consistently. */

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

export function jsonResult(value: unknown) {
  return textResult(JSON.stringify(value, null, 2));
}

export function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}
