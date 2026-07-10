// Client for the OpenVideo daemon (same-origin via next.config rewrites in dev).

export async function getJSON<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** Reads an SSE response body (EventSource is GET-only, so this covers our POST-driven streams),
 *  calling onMsg per `data:` frame. */
async function readSse(res: Response, onMsg: (m: Record<string, unknown>) => void): Promise<void> {
  if (!res.ok || !res.body) throw new Error(`${res.url} → ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split("\n\n");
    buf = frames.pop() ?? "";
    for (const f of frames) {
      const dataLine = f.split("\n").find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      try {
        onMsg(JSON.parse(dataLine.slice(5).trim()));
      } catch {
        /* ignore keepalives / partial frames */
      }
    }
  }
}

/** POST a JSON body and read the daemon's SSE response. */
export async function streamPost(
  path: string,
  body: unknown,
  onMsg: (m: Record<string, unknown>) => void,
): Promise<void> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  await readSse(res, onMsg);
}

/** Upload a File to a project (raw body) and return the ingest result. [legacy EDD path] */
export async function uploadClip(projectId: string, file: File): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/projects/${projectId}/upload?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    body: file,
  });
  if (!res.ok) throw new Error(`upload → ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Stream a source-video upload to a scaffolded workspace (ADR-0014) — the daemon streams back
 *  scaffold + pnpm-install progress lines over SSE, ending in a workspace.ready event. */
export async function uploadWorkspaceSource(
  workspaceId: string,
  file: File,
  onMsg: (m: Record<string, unknown>) => void,
): Promise<void> {
  const ext = (file.name.match(/\.[^.]+$/)?.[0] ?? ".mp4").slice(0, 8);
  const res = await fetch(`/api/workspaces/${workspaceId}/source?ext=${encodeURIComponent(ext)}`, {
    method: "POST",
    body: file,
  });
  await readSse(res, onMsg);
}
