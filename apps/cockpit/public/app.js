// OpenVideo cockpit (v0, served by the daemon). Talks ONLY to the local daemon.

const $ = (id) => document.getElementById(id);
const term = $("term");

function line(text, cls = "") {
  if (text == null) return;
  const el = document.createElement("div");
  el.className = `l ${cls}`;
  el.textContent = text;
  term.appendChild(el);
  term.scrollTop = term.scrollHeight;
}

/** Read an SSE stream from a fetch POST (EventSource is GET-only). Calls onMsg(parsedJson). */
async function streamPost(url, body, onMsg) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    line(`request failed: ${res.status}`, "err");
    return;
  }
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
        /* ignore keepalives / partials */
      }
    }
  }
}

function classify(msg) {
  const t = msg?.event?.type ?? msg?.type ?? "";
  if (t.includes("error") || t === "error") return "err";
  if (t === "render.done" || t === "node-done" || t === "agent.result") return "ok";
  if (t === "agent.tool_use") return "tool";
  if (t === "agent.thinking" || t === "node-cached") return "dim";
  return "";
}

async function loadProfile() {
  try {
    const p = await (await fetch("/api/profile")).json();
    const t = p.tools || {};
    $("status").textContent =
      `os=${p.os} · ffmpeg=${t.ffmpeg ? "✓" : "✗"} · claude=${t.claude ? "✓" : "✗"} · gpu=${p.gpu?.nvidia ? "NVIDIA" : "cpu"}`;
    if (!t.claude) $("send").title = "Claude CLI not detected on PATH";
  } catch {
    $("status").textContent = "daemon unreachable";
  }
}

async function runDemo() {
  $("demo").disabled = true;
  line("— rendering demo reel —", "dim");
  let output = null;
  await streamPost("/api/demo-render", {}, (m) => {
    line(m.line, classify(m));
    if (m.type === "render.done" && m.output) output = m.output;
  });
  if (output) {
    $("preview").src = `/api/file?path=${encodeURIComponent(output)}`;
    $("previewNote").textContent = output;
    line("preview loaded ✓", "ok");
  }
  $("demo").disabled = false;
}

async function sendIntent() {
  const prompt = $("intent").value.trim();
  if (!prompt) return;
  $("send").disabled = true;
  line(`› ${prompt}`, "");
  await streamPost(
    "/api/session",
    { prompt, model: $("model").value, effort: $("effort").value, mode: $("mode").value, refine: $("refine").checked },
    (m) => {
      line(m.line, classify(m));
      if (m.type === "prd.ready" && m.prdPrompt) line(`\n[PRD prompt]\n${m.prdPrompt}\n`, "dim");
    },
  );
  $("send").disabled = false;
}

async function uploadAndRender(file) {
  $("upload").disabled = true;
  try {
    line(`creating project for ${file.name}…`, "dim");
    const proj = await (
      await fetch("/api/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: file.name }) })
    ).json();
    line(`uploading ${file.name}…`, "dim");
    const up = await (
      await fetch(`/api/projects/${proj.id}/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", body: file })
    ).json();
    const p = up.source?.probe;
    line(`ingested ${up.source?.id} — ${p?.w}×${p?.h}, ${Number(p?.durationS).toFixed(1)}s`, "ok");
    let output = null;
    await streamPost(`/api/projects/${proj.id}/render`, {}, (m) => {
      line(m.line, classify(m));
      if (m.type === "render.done" && m.output) output = m.output;
    });
    if (output) {
      $("preview").src = `/api/file?path=${encodeURIComponent(output)}`;
      $("previewNote").textContent = output;
      line("preview loaded ✓", "ok");
    }
  } catch (e) {
    line(`upload failed: ${e}`, "err");
  }
  $("upload").disabled = false;
}

$("upload").addEventListener("click", () => $("file").click());
$("file").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) uploadAndRender(f);
  e.target.value = "";
});
$("demo").addEventListener("click", runDemo);
$("send").addEventListener("click", sendIntent);
$("intent").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendIntent();
});

loadProfile();
line("OpenVideo cockpit ready.", "dim");
