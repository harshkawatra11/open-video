import type { LucideIcon } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardBody } from "@/components/ui/Card";

export function ComingSoon({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-8 py-20">
        <Card className="border-dashed">
          <CardBody className="flex flex-col items-center gap-3 py-16 text-center">
            <Icon size={24} className="text-fg-3" />
            <h1 className="font-display text-h1 text-fg-0">{title}</h1>
            <p className="max-w-sm text-bodySm text-fg-3">{body}</p>
          </CardBody>
        </Card>
      </div>
    </AppShell>
  );
}
