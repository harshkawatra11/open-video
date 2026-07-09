"use client";

import { useEffect, useState } from "react";
import { Search, Lock, Music2, Wand2, Type, Film, Image as ImageIcon, Palette } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardBody } from "@/components/ui/Card";
import { Chip, type ChipTone } from "@/components/ui/Chip";
import { getJSON } from "@/lib/daemon";

type Kind = "font" | "broll" | "music" | "sfx" | "image" | "look";

const TABS: { kind: Kind; label: string; icon: typeof Type; tone: ChipTone }[] = [
  { kind: "font", label: "Fonts", icon: Type, tone: "font" },
  { kind: "broll", label: "B-roll", icon: Film, tone: "broll" },
  { kind: "music", label: "Music", icon: Music2, tone: "music" },
  { kind: "sfx", label: "SFX", icon: Wand2, tone: "sfx" },
  { kind: "image", label: "AI Images", icon: ImageIcon, tone: "image" },
  { kind: "look", label: "Looks", icon: Palette, tone: "vfx" },
];

interface AssetHit {
  providerId: string;
  id: string;
  kind: Kind;
  title: string;
  durationS?: number;
  license: string;
  attribution?: string;
  meta?: Record<string, unknown>;
}

interface ProviderInfo {
  id: string;
  license: string;
  enabled: boolean;
  auth: { type: "none" } | { type: "apiKey"; keyId: string };
}

export default function LibraryPage() {
  const [tab, setTab] = useState<Kind>("font");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<AssetHit[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams(q ? { q } : {});
    getJSON<{ hits: AssetHit[]; providers: ProviderInfo[] }>(`/api/library/${tab}/search?${params}`)
      .then((data) => {
        if (cancelled) return;
        setHits(data.hits ?? []);
        setProviders(data.providers ?? []);
      })
      .catch(() => !cancelled && setHits([]))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, q]);

  const active = TABS.find((t) => t.kind === tab)!;
  const disabledProviders = providers.filter((p) => !p.enabled);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-8 py-10">
        <h1 className="font-display text-display font-bold text-fg-0">Library</h1>
        <p className="mt-2 text-body text-fg-2">
          Fonts, b-roll, music, SFX, and images — every asset is licensed, generated, or user-supplied.
          Never scraped.
        </p>

        <div className="mt-6 flex gap-1 border-b border-line-1">
          {TABS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              onClick={() => setTab(kind)}
              className={
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-bodySm transition-colors " +
                (tab === kind
                  ? "border-accent text-fg-0"
                  : "border-transparent text-fg-3 hover:text-fg-1")
              }
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-md border border-line-2 bg-bg-2 px-3 py-2">
          <Search size={14} className="text-fg-3" />
          <input
            className="flex-1 bg-transparent text-body text-fg-0 outline-none placeholder:text-fg-3"
            placeholder={`Search ${active.label.toLowerCase()}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {disabledProviders.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {disabledProviders.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 rounded-pill border border-line-2 bg-bg-2 px-2.5 py-1 text-[11px] text-fg-3"
              >
                <Lock size={11} />
                {p.id} — add key to enable
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {loading && <p className="col-span-full text-bodySm text-fg-3">Searching…</p>}
          {!loading && hits.length === 0 && (
            <p className="col-span-full text-bodySm text-fg-3">No results.</p>
          )}
          {hits.map((h) => (
            <Card key={`${h.providerId}:${h.id}`} className="overflow-hidden">
              <div className="flex aspect-video items-center justify-center bg-bg-3 text-fg-3">
                <active.icon size={20} />
              </div>
              <CardBody>
                <div className="truncate text-h3 text-fg-0">{h.title}</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <Chip tone={active.tone}>{h.providerId}</Chip>
                  {h.durationS !== undefined && (
                    <span className="text-[11px] text-fg-3">{h.durationS}s</span>
                  )}
                </div>
                <div className="mt-2 truncate text-[11px] text-fg-3">{h.license}</div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
