import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ChipTone = "neutral" | "font" | "broll" | "music" | "sfx" | "image" | "vfx" | "success" | "warn" | "error";

const toneCls: Record<ChipTone, string> = {
  neutral: "bg-bg-3 text-fg-1 border-line-2",
  font: "bg-cat-font/10 text-cat-font border-cat-font/30",
  broll: "bg-cat-broll/10 text-cat-broll border-cat-broll/30",
  music: "bg-cat-music/10 text-cat-music border-cat-music/30",
  sfx: "bg-cat-sfx/10 text-cat-sfx border-cat-sfx/30",
  image: "bg-cat-image/10 text-cat-image border-cat-image/30",
  vfx: "bg-cat-vfx/10 text-cat-vfx border-cat-vfx/30",
  success: "bg-success/10 text-success border-success/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  error: "bg-error/10 text-error border-error/30",
};

export function Chip({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill border px-2 py-0.5 text-[11px] font-medium leading-4 tracking-wide uppercase",
        toneCls[tone],
        className,
      )}
      {...props}
    />
  );
}
