// Client for the OpenVideo daemon (same-origin via next.config rewrites in dev).

export async function getJSON<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return (await res.json()) as T;
}

/** Read a daemon SSE stream from a POST (EventSource is GET-only). Calls onMsg per data frame. */
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
  if (!res.ok || !res.body) throw new Error(`${path} → ${res.status}`);
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

/** Upload a File to a project (raw body) and return the ingest result. */
export async function uploadClip(projectId: string, file: File): Promise<Record<string, unknown>> {
  const res = await fetch(`/api/projects/${projectId}/upload?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    body: file,
  });
  if (!res.ok) throw new Error(`upload → ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}
