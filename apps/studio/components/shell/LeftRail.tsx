"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Settings } from "lucide-react";
import { cn } from "@/lib/cn";

// Thin-agent-wrapper UI (ADR-0014): a scaffolded workspace + a headless Claude session replace the
// EDD/Library/Brand-Kit/Agents/Plugins/Render-Queue surface those screens were built around, so
// they're parked along with the packages/routes behind them rather than left as dead nav entries.
const NAV = [
  { href: "/", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Setup", icon: Settings },
];

export function LeftRail() {
  const pathname = usePathname();
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-line-1 bg-bg-1 py-3">
      <div className="px-4 pb-4">
        <span className="font-display text-[15px] font-semibold tracking-tight text-fg-0">
          Open<span className="text-accent">Video</span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors duration-std",
                active
                  ? "bg-bg-3 text-fg-0"
                  : "text-fg-2 hover:bg-bg-2 hover:text-fg-1",
              )}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 pt-3 text-[11px] text-fg-3">v0.1.0 · local-first</div>
    </aside>
  );
}
