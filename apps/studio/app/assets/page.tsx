import { Layers } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export default function AssetsPage() {
  return (
    <ComingSoon
      icon={Layers}
      title="Assets"
      body="A unified view across every project's ingested footage and library-sourced assets is planned for a later pass. For now, browse per-project assets from the Studio timeline."
    />
  );
}
