"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Send, Wand2, Video, Type, Image as ImageIcon, Music, Film } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { getJSON, streamPost } from "@/lib/daemon";

interface TermLine {
  id: number;
  text: string;
  kind: "info" | "error" | "done";
}

interface Clip {
  id: string;
  src?: string;
  inS?: number;
  outS?: number;
  atS?: [number, number];
}

interface Track {
  id: string;
  kind: string;
  clips?: Clip[];
  items?: Clip[];
  words?: Array<{ t: string; startS: number; endS: number; emph?: boolean }>;
}

const TRACK_ICON: Record<string, typeof Video> = {
  video: Video,
  broll: Film,
  captions: Type,
  graphics: ImageIcon,
  audio: Music,
};

const TRACK_TONE: Record<string, ChipTone> = {
  video: "neutral",
  broll: "broll",
  captions: "font",
  graphics: "image",
  audio: "music",
};

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const [edd, setEdd] = useState<Record<string, unknown> | null>(null);
  const [prompt, setPrompt] = useState("");
  const [lines, setLines] = useState<TermLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<{ track: Track; clip?: Clip } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function loadEdd() {
    try {
      const data = await getJSON<Record<string, unknown>>(`/api/projects/${id}/edd`);
      setEdd(Object.keys(data).length > 0 ? data : null);
    } catch {
      setEdd(null);
    }
  }

  useEffect(() => {
    loadEdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  function log(text: string, kind: TermLine["kind"] = "info") {
    setLines((prev) => [...prev, { id: nextId.current++, text, kind }]);
  }

  async function runRender() {
    setBusy(true);
    log("Starting render…");
    try {
      await streamPost(`/api/projects/${id}/render`, {}, (m) => {
        const line = (m.line as string) ?? JSON.stringify(m);
        log(line, m.type === "error" ? "error" : m.type === "render.done" ? "done" : "info");
        if (m.type === "render.done" && typeof m.output === "string") {
          setPreviewUrl(`/api/file?path=${encodeURIComponent(m.output)}`);
        }
      });
    } catch (e) {
      log(`Render failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendPrompt() {
    if (!prompt.trim() || busy) return;
    const p = prompt;
    setPrompt("");
    log(`> ${p}`);
    setBusy(true);
    try {
      await streamPost("/api/session", { prompt: p, projectId: id, mode: "auto" }, (m) => {
        const line = (m.line as string) ?? JSON.stringify(m);
        log(line);
      });
      await loadEdd(); // the Director may have patched the EDD — refresh the timeline
    } catch (e) {
      log(`Session failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  const timeline = edd?.timeline as { tracks?: Track[]; durationS?: number } | undefined;
  const tracks = timeline?.tracks ?? [];

  return (
    <AppShell>
      <div className="grid h-full grid-cols-[1fr_1.3fr_320px]">
        {/* Left: intent chat + alive terminal */}
        <div className="flex min-w-0 flex-col border-r border-line-1">
          <div className="border-b border-line-1 px-4 py-3">
            <h2 className="text-h3 text-fg-0">Director</h2>
            <p className="text-bodySm text-fg-3">Describe the intent — plan, patch, or render.</p>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-1 overflow-auto px-4 py-3 font-mono text-mono">
            {lines.length === 0 && <p className="text-fg-3">Session log will stream here.</p>}
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={
                    l.kind === "error" ? "text-error" : l.kind === "done" ? "text-success" : "text-fg-1"
                  }
                >
                  {l.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 border-t border-line-1 p-3">
            <input
              className="min-w-0 flex-1 rounded-md border border-line-2 bg-bg-2 px-3 py-2 text-body text-fg-0 outline-none placeholder:text-fg-3 focus:border-accent"
              placeholder="e.g. turn this into a punchy 30s reel with captions"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendPrompt()}
              disabled={busy}
            />
            <Button variant="primary" onClick={sendPrompt} disabled={busy}>
              <Send size={14} />
            </Button>
          </div>
        </div>

        {/* Center: preview + timeline */}
        <div className="flex min-w-0 flex-col border-r border-line-1">
          <div className="flex items-center justify-between border-b border-line-1 px-4 py-3">
            <h2 className="text-h3 text-fg-0">Preview</h2>
            <Button variant="primary" size="sm" onClick={runRender} disabled={busy || !edd}>
              <Play size={13} />
              Render
            </Button>
          </div>
          <div className="flex flex-1 items-center justify-center bg-bg-1">
            {previewUrl ? (
              <video src={previewUrl} controls className="h-[70%] rounded-md border border-line-2" />
            ) : (
              <div className="flex aspect-[9/16] h-[70%] items-center justify-center rounded-md border border-line-2 bg-bg-3 text-fg-3">
                no frame yet
              </div>
            )}
          </div>
          <div className="border-t border-line-1 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-label uppercase tracking-wide text-fg-3">Timeline</h3>
              {timeline?.durationS && (
                <span className="text-[11px] text-fg-3">{timeline.durationS.toFixed(1)}s</span>
              )}
            </div>
            <div className="space-y-1.5">
              {tracks.length === 0 && <p className="text-bodySm text-fg-3">No EDD loaded yet.</p>}
              {tracks.map((t) => {
                const Icon = TRACK_ICON[t.kind] ?? Video;
                const clips = t.clips ?? t.items;
                return (
                  <div key={t.id} className="rounded-sm border border-line-1 bg-bg-2">
                    <button
                      onClick={() => setSelected({ track: t })}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-bodySm text-fg-1 hover:bg-bg-3"
                    >
                      <Icon size={13} className="text-fg-3" />
                      <Chip tone={TRACK_TONE[t.kind] ?? "neutral"}>{t.kind}</Chip>
                      <span className="text-fg-3">
                        {clips ? `${clips.length} clip${clips.length === 1 ? "" : "s"}` : t.words ? `${t.words.length} words` : ""}
                      </span>
                    </button>
                    {clips && clips.length > 0 && (
                      <div className="space-y-0.5 border-t border-line-1 px-2.5 py-1.5">
                        {clips.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => setSelected({ track: t, clip: c })}
                            className="flex w-full items-center justify-between rounded-sm px-1.5 py-1 text-[11px] text-fg-2 hover:bg-bg-3 hover:text-fg-0"
                          >
                            <span className="truncate">{c.id}</span>
                            <span className="text-fg-3">
                              {c.atS ? `@${c.atS[0]}–${c.atS[1]}s` : `${c.inS ?? 0}–${c.outS ?? 0}s`}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: inspector */}
        <div className="flex min-w-0 flex-col">
          <Card className="m-3 border-0 border-b border-line-1 rounded-none">
            <CardHeader className="flex items-center gap-2">
              <Wand2 size={14} className="text-accent" />
              <span className="text-h3 text-fg-0">Inspector</span>
            </CardHeader>
            <CardBody className="text-bodySm text-fg-3">
              {!selected && "Select a track or clip on the timeline to inspect it here."}
              {selected && (
                <div className="space-y-3">
                  <div>
                    <div className="text-label uppercase tracking-wide text-fg-3">Track</div>
                    <div className="mt-1 flex items-center gap-2">
                      <Chip tone={TRACK_TONE[selected.track.kind] ?? "neutral"}>{selected.track.kind}</Chip>
                      <span className="text-fg-1">{selected.track.id}</span>
                    </div>
                  </div>
                  {selected.clip && (
                    <div>
                      <div className="text-label uppercase tracking-wide text-fg-3">Clip</div>
                      <pre className="mt-1 overflow-auto rounded-md border border-line-1 bg-bg-2 p-2.5 font-mono text-[11px] text-fg-1">
                        {JSON.stringify(selected.clip, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
