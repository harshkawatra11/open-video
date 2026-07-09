"use client";

import { useEffect, useState } from "react";
import { Palette, Save, Check } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getJSON } from "@/lib/daemon";

interface ProjectSummary {
  id: string;
  name: string;
}

export default function BrandKitPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [content, setContent] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJSON<{ projects: ProjectSummary[] }>("/api/projects")
      .then((d) => {
        setProjects(d.projects ?? []);
        if (d.projects?.[0]) setProjectId(d.projects[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getJSON<{ content: string }>(`/api/projects/${projectId}/style`)
      .then((d) => setContent(d.content))
      .catch(() => setContent(""))
      .finally(() => setLoading(false));
  }, [projectId]);

  async function save() {
    await fetch(`/api/projects/${projectId}/style`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="font-display text-display font-bold text-fg-0">Brand Kit</h1>
        <p className="mt-2 text-body text-fg-2">
          The project's STYLE.md — palette, typography, caption treatment, motion, pacing, audio
          targets, and grade defaults. The Director respects this unless your intent overrides it.
        </p>

        <div className="mt-6 flex items-center gap-2">
          <label className="text-bodySm text-fg-3">Project</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded-md border border-line-2 bg-bg-2 px-2.5 py-1.5 text-bodySm text-fg-0 outline-none focus:border-accent"
          >
            {projects.length === 0 && <option value="">No projects yet</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <Card className="mt-6">
          <CardHeader className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Palette size={14} className="text-accent" />
              <span className="text-h3 text-fg-0">STYLE.md</span>
            </div>
            <Button variant="primary" size="sm" onClick={save} disabled={!projectId || loading}>
              {saved ? <Check size={13} /> : <Save size={13} />}
              {saved ? "Saved" : "Save"}
            </Button>
          </CardHeader>
          <CardBody>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!projectId || loading}
              spellCheck={false}
              className="h-96 w-full resize-none rounded-md border border-line-2 bg-bg-2 p-3 font-mono text-mono text-fg-1 outline-none focus:border-accent"
            />
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
