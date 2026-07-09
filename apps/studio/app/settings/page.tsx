"use client";

import { useEffect, useState } from "react";
import { KeyRound, Check, Lock, Stethoscope, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getJSON } from "@/lib/daemon";

interface KeyedProvider {
  id: string;
  label: string;
  hint: string;
}

interface DoctorCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  suggestion?: string;
}

const STATUS_ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle } as const;
const STATUS_COLOR = { pass: "text-success", warn: "text-warn", fail: "text-error" } as const;

function DoctorPanel() {
  const [checks, setChecks] = useState<DoctorCheck[] | null>(null);

  async function run() {
    setChecks(null);
    try {
      const data = await getJSON<{ checks: DoctorCheck[] }>("/api/doctor");
      setChecks(data.checks ?? []);
    } catch {
      setChecks([]);
    }
  }

  useEffect(() => {
    run();
  }, []);

  return (
    <Card className="mb-8">
      <CardHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope size={14} className="text-accent" />
          <span className="text-h3 text-fg-0">Doctor</span>
        </div>
        <Button variant="secondary" size="sm" onClick={run}>
          Re-run
        </Button>
      </CardHeader>
      <CardBody className="space-y-2">
        {checks === null && <p className="text-bodySm text-fg-3">Running checks…</p>}
        {checks?.map((c) => {
          const Icon = STATUS_ICON[c.status];
          return (
            <div key={c.id} className="flex items-start gap-2.5">
              <Icon size={15} className={`mt-0.5 shrink-0 ${STATUS_COLOR[c.status]}`} />
              <div>
                <div className="text-bodySm text-fg-0">{c.label}</div>
                <div className="text-[11px] text-fg-3">{c.detail}</div>
                {c.status !== "pass" && c.suggestion && (
                  <div className="text-[11px] text-fg-2">{c.suggestion}</div>
                )}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

const KEY_GATED_PROVIDERS: KeyedProvider[] = [
  { id: "pexels", label: "Pexels", hint: "Stock b-roll video" },
  { id: "pixabay", label: "Pixabay", hint: "Stock b-roll video" },
  { id: "freesound", label: "Freesound", hint: "SFX library" },
  { id: "free-music-archive", label: "Free Music Archive", hint: "Licensed music" },
  { id: "hosted-image", label: "Hosted Image API", hint: "AI image generation (provider-agnostic)" },
];

export default function SettingsPage() {
  const [configured, setConfigured] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await getJSON<{ keys: string[] }>("/api/keystore");
      setConfigured(new Set(data.keys ?? []));
    } catch {
      setConfigured(new Set());
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function saveKey(id: string) {
    const value = drafts[id]?.trim();
    if (!value) return;
    setSaving(id);
    try {
      await fetch("/api/keystore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyId: id, value }),
      });
      setDrafts((d) => ({ ...d, [id]: "" }));
      await refresh();
    } finally {
      setSaving(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="font-display text-display font-bold text-fg-0">Settings</h1>
        <p className="mt-2 text-body text-fg-2">
          Provider API keys, encrypted at rest (AES-256-GCM) and never sent to the renderer or agents
          directly — the daemon is the only process that reads them (ADR-0008).
        </p>

        <div className="mt-8">
          <DoctorPanel />
        </div>

        <div className="space-y-3">
          <h2 className="text-label uppercase tracking-wide text-fg-3">Library provider keys</h2>
          {KEY_GATED_PROVIDERS.map((p) => {
            const isSet = configured.has(p.id);
            return (
              <Card key={p.id}>
                <CardHeader className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound size={14} className="text-fg-3" />
                    <span className="text-h3 text-fg-0">{p.label}</span>
                    <span className="text-bodySm text-fg-3">— {p.hint}</span>
                  </div>
                  {isSet ? (
                    <span className="flex items-center gap-1 text-bodySm text-success">
                      <Check size={13} /> configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-bodySm text-fg-3">
                      <Lock size={13} /> not configured
                    </span>
                  )}
                </CardHeader>
                <CardBody className="flex gap-2">
                  <input
                    type="password"
                    placeholder={isSet ? "Replace key…" : "Paste API key…"}
                    value={drafts[p.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    className="flex-1 rounded-md border border-line-2 bg-bg-2 px-3 py-2 text-body text-fg-0 outline-none placeholder:text-fg-3 focus:border-accent"
                  />
                  <Button variant="primary" onClick={() => saveKey(p.id)} disabled={saving === p.id || !drafts[p.id]}>
                    Save
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
