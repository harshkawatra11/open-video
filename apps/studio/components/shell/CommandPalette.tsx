"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  FolderKanban,
  Library,
  Palette,
  ListVideo,
  Settings,
  UploadCloud,
  Sparkles,
} from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Dialog, DialogContent } from "@/components/ui/Dialog";

interface Item {
  id: string;
  label: string;
  hint?: string;
  icon: typeof FolderKanban;
  action: () => void;
}

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  function go(path: string) {
    router.push(path);
    setOpen(false);
  }

  const items: Item[] = [
    { id: "home", label: "Go to Projects", icon: FolderKanban, action: () => go("/") },
    { id: "library", label: "Go to Library", icon: Library, action: () => go("/library") },
    { id: "brand", label: "Go to Brand Kit", icon: Palette, action: () => go("/brand") },
    { id: "renders", label: "Go to Render Queue", icon: ListVideo, action: () => go("/renders") },
    { id: "settings", label: "Go to Settings", icon: Settings, action: () => go("/settings") },
    {
      id: "new",
      label: "Drop a clip / new project",
      hint: "⇧N",
      icon: UploadCloud,
      action: () => go("/"),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent open={open} className="overflow-hidden p-0">
        <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
        <Command
          className="flex flex-col"
          filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <div className="flex items-center gap-2 border-b border-line-1 px-4 py-3">
            <Sparkles size={14} className="text-accent" />
            <Command.Input
              autoFocus
              placeholder="Search or jump to…"
              className="w-full bg-transparent text-body text-fg-0 outline-none placeholder:text-fg-3"
            />
          </div>
          <Command.List className="max-h-80 overflow-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-bodySm text-fg-3">
              No matches.
            </Command.Empty>
            {items.map(({ id, label, hint, icon: Icon, action }) => (
              <Command.Item
                key={id}
                value={label}
                onSelect={action}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-bodySm text-fg-1 aria-selected:bg-bg-3 aria-selected:text-fg-0"
              >
                <Icon size={15} />
                <span className="flex-1">{label}</span>
                {hint && <kbd className="text-[10px] text-fg-3">{hint}</kbd>}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
