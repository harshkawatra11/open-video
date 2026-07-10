"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Film, Loader2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { getJSON, uploadWorkspaceSource } from "@/lib/daemon";

interface WorkspaceSummary {
  id: string;
  name: string;
  status: string;
  createdAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending_source: "awaiting upload",
  scaffolding: "scaffolding…",
  ready: "ready to edit",
  editing: "editing…",
  edited: "edited",
  incomplete: "incomplete — retry",
  error: "error",
};

export default function HomePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [prd, setPrd] = useState("");
  const [brandContext, setBrandContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [progressLine, setProgressLine] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const data = await getJSON<{ workspaces: WorkspaceSummary[] }>("/api/workspaces");
      setWorkspaces(data.workspaces ?? []);
    } catch {
      setWorkspaces([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFile(file: File) {
    if (!prd.trim()) {
      setProgressLine("Describe the edit in the brief below before dropping a clip.");
      return;
    }
    setBusy(true);
    setProgressLine("Creating workspace…");
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, ""), prd, brandContext }),
      });
      const ws = (await res.json()) as { id: string };
      await uploadWorkspaceSource(ws.id, file, (m) => {
        if (typeof m.line === "string") setProgressLine(m.line);
      });
      router.push(`/studio/${ws.id}`);
    } catch (e) {
      setProgressLine(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-8 py-14">
        <h1 className="font-display text-displayXl font-bold text-fg-0">
          Turn footage into a <span className="text-accent">cinematic cut.</span>
        </h1>
        <p className="mt-3 max-w-xl text-body text-fg-2">
          Drop a clip and describe the edit — a headless Claude Code session, with full tool freedom
          (ffmpeg, Remotion, no fixed schema), scaffolds the workspace and does the edit.
        </p>

        <div className="mt-8 max-w-xl">
          <label className="mb-1.5 block text-label uppercase tracking-wide text-fg-3">
            Brief / PRD
          </label>
          <textarea
            className="h-28 w-full resize-none rounded-md border border-line-2 bg-bg-2 px-3 py-2 text-body text-fg-0 outline-none placeholder:text-fg-3 focus:border-accent"
            placeholder="e.g. turn this into a punchy 30s reel with captions, hook in the first 3s..."
            value={prd}
            onChange={(e) => setPrd(e.target.value)}
            disabled={busy}
          />
          <label className="mb-1.5 mt-3 block text-label uppercase tracking-wide text-fg-3">
            Brand context (optional)
          </label>
          <input
            className="w-full rounded-md border border-line-2 bg-bg-2 px-3 py-2 text-body text-fg-0 outline-none placeholder:text-fg-3 focus:border-accent"
            placeholder="who's on screen, tone, identity rules..."
            value={brandContext}
            onChange={(e) => setBrandContext(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button variant="primary" size="lg" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            Drop a clip
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          {progressLine && <span className="text-bodySm text-fg-3">{progressLine}</span>}
        </div>

        <div className="mt-14">
          <h2 className="mb-3 text-label uppercase tracking-wide text-fg-3">Edits</h2>
          {workspaces.length === 0 ? (
            <Card className="border-dashed">
              <CardBody className="flex flex-col items-center gap-2 py-14 text-center">
                <Film size={22} className="text-fg-3" />
                <p className="text-bodySm text-fg-2">No edits yet — drop your first clip above.</p>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((w) => (
                <Card
                  key={w.id}
                  className="cursor-pointer transition-colors hover:border-line-3"
                  onClick={() => router.push(`/studio/${w.id}`)}
                >
                  <div className="flex aspect-video items-center justify-center rounded-t-lg bg-bg-3 text-fg-3">
                    <Film size={22} />
                  </div>
                  <CardBody>
                    <div className="truncate text-h3 text-fg-0">{w.name}</div>
                    <div className="mt-1 text-bodySm text-fg-3">
                      {STATUS_LABEL[w.status] ?? w.status} · {new Date(w.createdAt).toLocaleDateString()}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
