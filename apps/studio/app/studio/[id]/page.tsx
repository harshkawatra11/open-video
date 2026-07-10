"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Play } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { getJSON, streamPost, daemonUrl } from "@/lib/daemon";

interface TermLine {
  id: number;
  text: string;
  kind: "info" | "error" | "done";
}

interface Workspace {
  id: string;
  name: string;
  status: string;
  errorMessage?: string;
}

// ADR-0014 thin-agent-wrapper studio page: no EDD/timeline inspector — the workspace is a headless
// Claude Code session with full tool freedom, so there's nothing structured to inspect mid-edit.
// This is: a live feed of what the agent is doing, the rendered preview once it exists, and a
// tweak box that resumes the same session.
export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [lines, setLines] = useState<TermLine[]>([]);
  const [tweakText, setTweakText] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const nextId = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeq = useRef(-1);

  function log(text: string, kind: TermLine["kind"] = "info") {
    setLines((prev) => [...prev, { id: nextId.current++, text, kind }]);
  }

  async function refreshWorkspace() {
    try {
      const ws = await getJSON<Workspace>(`/api/workspaces/${id}`);
      setWorkspace(ws);
    } catch {
      setWorkspace(null);
    }
  }

  // On mount, replay any buffered events (covers a browser refresh mid-edit — a real edit can run
  // 10-15+ min, so losing the feed on refresh would be a bad experience). This must NEVER start a
  // real Claude session on its own — an edit is a real cost/time commitment and has to be an
  // explicit click (the "Run edit" button), not a side effect of navigating to a URL.
  async function replayEvents() {
    await refreshWorkspace();
    try {
      const data = await getJSON<{ events: Array<{ seq: number; event: { line?: string | null } }>; status: string }>(
        `/api/workspaces/${id}/events?since=-1`,
      );
      for (const e of data.events) {
        lastSeq.current = e.seq;
        if (e.event.line) log(e.event.line);
      }
    } catch {
      /* ignore — replay is best-effort */
    }
  }

  useEffect(() => {
    replayEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  async function runEdit() {
    setBusy(true);
    log("Starting edit…");
    try {
      await streamPost(`/api/workspaces/${id}/edit`, {}, (m) => {
        const line = (m.line as string) ?? null;
        if (line) log(line, m.type === "error" || m.type === "agent.error" ? "error" : "info");
      });
      setPreviewKey((k) => k + 1);
      await refreshWorkspace();
    } catch (e) {
      log(`Edit failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  async function sendTweak() {
    if (!tweakText.trim() || busy) return;
    const text = tweakText;
    setTweakText("");
    log(`> ${text}`);
    setBusy(true);
    try {
      await streamPost(`/api/workspaces/${id}/tweak`, { text }, (m) => {
        const line = (m.line as string) ?? null;
        if (line) log(line, m.type === "error" || m.type === "agent.error" ? "error" : "info");
      });
      setPreviewKey((k) => k + 1);
      await refreshWorkspace();
    } catch (e) {
      log(`Tweak failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  }

  const previewUrl = daemonUrl(`/api/workspaces/${id}/output?v=${previewKey}`);
  const hasOutput = workspace?.status === "edited";

  return (
    <AppShell>
      <div className="grid h-full min-h-0 grid-cols-[1fr_1.2fr] overflow-hidden">
        {/* Left: live feed + tweak chat */}
        <div className="flex min-h-0 min-w-0 flex-col border-r border-line-1">
          <div className="border-b border-line-1 px-4 py-3">
            <h2 className="text-h3 text-fg-0">{workspace?.name ?? "Edit"}</h2>
            <p className="text-bodySm text-fg-3">
              {workspace ? `status: ${workspace.status}` : "loading…"}
            </p>
          </div>
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-auto px-4 py-3 font-mono text-mono">
            {lines.length === 0 && <p className="text-fg-3">Session log will stream here.</p>}
            <AnimatePresence initial={false}>
              {lines.map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15 }}
                  className={l.kind === "error" ? "text-error" : l.kind === "done" ? "text-success" : "text-fg-1"}
                >
                  {l.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 border-t border-line-1 p-3">
            <input
              className="min-w-0 flex-1 rounded-md border border-line-2 bg-bg-2 px-3 py-2 text-body text-fg-0 outline-none placeholder:text-fg-3 focus:border-accent"
              placeholder="e.g. make the hook punchier, fix the caption timing at 0:12"
              value={tweakText}
              onChange={(e) => setTweakText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTweak()}
              disabled={busy || !hasOutput}
            />
            <Button variant="primary" onClick={sendTweak} disabled={busy || !hasOutput}>
              <Send size={14} />
            </Button>
          </div>
        </div>

        {/* Right: preview */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-line-1 px-4 py-3">
            <h2 className="text-h3 text-fg-0">Preview</h2>
            {!hasOutput && !busy && (workspace?.status === "ready" || workspace?.status === "incomplete") && (
              <Button variant="primary" size="sm" onClick={runEdit}>
                <Play size={13} />
                {workspace.status === "incomplete" ? "Retry edit" : "Run edit"}
              </Button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto flex items-center justify-center bg-bg-1">
            {hasOutput ? (
              <video key={previewKey} src={previewUrl} controls className="max-h-full max-w-full rounded-md border border-line-2" />
            ) : (
              <div className="flex aspect-[9/16] h-[70%] items-center justify-center rounded-md border border-line-2 bg-bg-3 text-center text-fg-3">
                {workspace?.status === "error" && (workspace.errorMessage ?? "Something went wrong.")}
                {workspace?.status === "incomplete" &&
                  "The session ended without finishing the edit (interrupted, or hit a wall) — no output was produced. Retry above."}
                {workspace?.status !== "error" && workspace?.status !== "incomplete" && "no output yet"}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
