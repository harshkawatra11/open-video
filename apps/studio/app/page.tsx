"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FilePlus2, Film } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { getJSON, uploadClip } from "@/lib/daemon";

interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  platform: string;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    try {
      const data = await getJSON<{ projects: ProjectSummary[] }>("/api/projects");
      setProjects(data.projects ?? []);
    } catch {
      setProjects([]);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, "") }),
      });
      const proj = (await res.json()) as { id: string };
      await uploadClip(proj.id, file);
      router.push(`/studio/${proj.id}`);
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
          Drop a clip and describe the intent — the agent plans, compiles, and renders. Or take full
          manual control over every frame, grade, caption, and cue.
        </p>

        <div className="mt-8 flex gap-3">
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <UploadCloud size={16} />
            Drop a clip
          </Button>
          <Button variant="secondary" size="lg" disabled={busy}>
            <FilePlus2 size={16} />
            Paste a brief
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
        </div>

        <div className="mt-14">
          <h2 className="mb-3 text-label uppercase tracking-wide text-fg-3">Recent projects</h2>
          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardBody className="flex flex-col items-center gap-2 py-14 text-center">
                <Film size={22} className="text-fg-3" />
                <p className="text-bodySm text-fg-2">No projects yet — drop your first clip above.</p>
              </CardBody>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Card
                  key={p.id}
                  className="cursor-pointer transition-colors hover:border-line-3"
                  onClick={() => router.push(`/studio/${p.id}`)}
                >
                  <div className="flex aspect-video items-center justify-center rounded-t-lg bg-bg-3 text-fg-3">
                    <Film size={22} />
                  </div>
                  <CardBody>
                    <div className="truncate text-h3 text-fg-0">{p.name}</div>
                    <div className="mt-1 text-bodySm text-fg-3">
                      {p.platform} · {new Date(p.createdAt).toLocaleDateString()}
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
