"use client";

import { useEffect, useState } from "react";
import { Puzzle, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { getJSON } from "@/lib/daemon";

interface PluginManifest {
  name: string;
  version: string;
  type: string;
  capabilities: string[];
  permissions: string[];
  license: string;
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);

  useEffect(() => {
    getJSON<{ plugins: PluginManifest[] }>("/api/plugins")
      .then((d) => setPlugins(d.plugins ?? []))
      .catch(() => setPlugins([]));
  }, []);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="font-display text-display font-bold text-fg-0">Plugins</h1>
        <p className="mt-2 text-body text-fg-2">
          First-party plugins discovered under <code className="text-fg-1">plugins/</code> (doc 15). The
          sandboxed loader for untrusted third-party plugins isn't built yet — these run with full
          ambient access, same as any first-party package.
        </p>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-warn/30 bg-warn/10 p-3 text-bodySm text-warn">
          <ShieldAlert size={15} className="mt-0.5 shrink-0" />
          <span>No worker/VM sandbox yet — only install plugins you trust.</span>
        </div>

        <div className="mt-6 space-y-3">
          {plugins.length === 0 && (
            <Card className="border-dashed">
              <CardBody className="flex flex-col items-center gap-2 py-14 text-center">
                <Puzzle size={22} className="text-fg-3" />
                <p className="text-bodySm text-fg-2">No plugins discovered.</p>
              </CardBody>
            </Card>
          )}
          {plugins.map((p) => (
            <Card key={p.name}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Puzzle size={14} className="text-accent" />
                  <span className="text-h3 text-fg-0">{p.name}</span>
                  <span className="text-bodySm text-fg-3">v{p.version}</span>
                </div>
                <Chip tone="neutral">{p.type}</Chip>
              </CardHeader>
              <CardBody className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {p.capabilities.map((c) => (
                    <span key={c} className="rounded-pill border border-line-2 bg-bg-2 px-2 py-0.5 text-[11px] text-fg-2">
                      {c}
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-fg-3">{p.license}</div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
