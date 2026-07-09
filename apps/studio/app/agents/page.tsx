import { Bot } from "lucide-react";
import { ComingSoon } from "@/components/shell/ComingSoon";

export default function AgentsPage() {
  return (
    <ComingSoon
      icon={Bot}
      title="Agents"
      body="OpenVideo currently runs a single Director agent (packages/agents) driving the full MCP toolset. The fuller specialist roster (Planner, Caption, Color, Audio, QA, ...) from doc 05 is a planned follow-up."
    />
  );
}
