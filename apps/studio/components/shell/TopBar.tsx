"use client";

import { useEffect, useState } from "react";
import { Search, Gauge, Sparkles } from "lucide-react";
import { getJSON } from "@/lib/daemon";

interface Usage {
  sessions: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJSON("/health")
      .then(() => !cancelled && setOnline(true))
      .catch(() => !cancelled && setOnline(false));

    function pollUsage() {
      getJSON<Usage>("/api/usage")
        .then((u) => !cancelled && setUsage(u))
        .catch(() => {});
    }
    pollUsage();
    const id = setInterval(pollUsage, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const totalTokens = usage ? usage.inputTokens + usage.outputTokens : 0;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line-1 bg-bg-1 px-4">
      <button
        className="flex flex-1 max-w-md items-center gap-2 rounded-md border border-line-2 bg-bg-2 px-3 py-1.5 text-[12px] text-fg-3 transition-colors hover:border-line-3"
        onClick={onOpenPalette}
      >
        <Search size={14} />
        <span>Search or jump to…</span>
        <kbd className="ml-auto rounded bg-bg-3 px-1.5 py-0.5 text-[10px] text-fg-2">⌘K</kbd>
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5 rounded-pill border border-line-2 bg-bg-2 px-2.5 py-1 text-[11px] text-fg-2">
        <Sparkles size={12} className="text-accent" />
        <span>Opus · high effort</span>
      </div>

      <div
        className="flex items-center gap-1.5 rounded-pill border border-line-2 bg-bg-2 px-2.5 py-1 text-[11px] text-fg-2"
        title={usage ? `${usage.sessions} session(s) · ${formatTokens(usage.cacheReadTokens)} cache-read tokens` : undefined}
      >
        <Gauge size={12} />
        <span>{usage ? `${formatTokens(totalTokens)} tokens` : "Usage · —"}</span>
      </div>

      <div className="flex items-center gap-1.5 text-[11px]">
        <span
          className={
            "h-1.5 w-1.5 rounded-full " +
            (online === null ? "bg-fg-3" : online ? "bg-success" : "bg-error")
          }
        />
        <span className="text-fg-3">
          {online === null ? "connecting…" : online ? "daemon online" : "daemon offline"}
        </span>
      </div>
    </header>
  );
}
