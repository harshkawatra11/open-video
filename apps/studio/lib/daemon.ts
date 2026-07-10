// Client for the OpenVideo daemon.
//
// In production the daemon serves this built app itself (same origin, relative paths). In dev
// (`next dev` on its own port), calls go straight to the daemon at NEXT_PUBLIC_OPENVIDEO_DAEMON
// (set in next.config.mjs) instead of through Next's rewrites() proxy — see next.config.mjs for
// why: the rewrite proxy does not stream a long-lived SSE response incrementally to the browser.
const DAEMON_BASE = process.env.NEXT_PUBLIC_OPENVIDEO_DAEMON ?? "";

function url(path: string): string {
  return `${DAEMON_BASE}${path}`;
}

/** Build a full daemon URL for use outside fetch() — e.g. a <video src>. Confirmed live as a real
 *  bug: the studio/[id] preview player built its src as a bare relative path
 *  (`/api/workspaces/.../output`), which in dev hits Next's own dev server on :3000 (no such
 *  route there) instead of the daemon on :7777, failing with MEDIA_ELEMENT_ERROR "Format error" /
 *  NETWORK_NO_SOURCE — every other daemon call in this file went through fetch(url(...)) and was
 *  fine, this one didn't. */
export function daemonUrl(path: string): string {
  return url(path);
}

export async function getJSON<T = unknown>(path: string): Promise<T> {
  const res = await fetch(url(path));
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
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  await readSse(res, onMsg);
}

/** Upload a File to a project (raw body) and return the ingest result. [legacy EDD path] */
export async function uploadClip(projectId: string, file: File): Promise<Record<string, unknown>> {
  const res = await fetch(url(`/api/projects/${projectId}/upload?name=${encodeURIComponent(file.name)}`), {
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
  const res = await fetch(url(`/api/workspaces/${workspaceId}/source?ext=${encodeURIComponent(ext)}`), {
    method: "POST",
    body: file,
  });
  await readSse(res, onMsg);
}
