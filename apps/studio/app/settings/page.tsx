"use client";

import { useEffect, useState } from "react";
import { Stethoscope, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getJSON } from "@/lib/daemon";

interface DoctorCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  suggestion?: string;
}

const STATUS_ICON = { pass: CheckCircle2, warn: AlertTriangle, fail: XCircle } as const;
const STATUS_COLOR = { pass: "text-success", warn: "text-warn", fail: "text-error" } as const;

export default function SettingsPage() {
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
    <AppShell>
      <div className="mx-auto max-w-3xl px-8 py-10">
        <h1 className="font-display text-display font-bold text-fg-0">Setup</h1>
        <p className="mt-2 text-body text-fg-2">
          What&apos;s installed and ready on this machine for the edit toolchain (ffmpeg, Claude CLI,
          pnpm/Remotion, GPU).
        </p>

        <Card className="mt-8">
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
      </div>
    </AppShell>
  );
}
