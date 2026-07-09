/**
 * End-to-end spine demo (no media required): EDD -> compile -> execution DAG -> planned
 * FFmpeg/Remotion command lines. Run: `pnpm --filter @openvideo/render demo`.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { compile } from "@openvideo/compiler";
import { planDAG } from "../src/index.ts";
import type { ToolContext } from "../src/index.ts";
import type { EDD } from "@openvideo/edd";

const here = path.dirname(fileURLToPath(import.meta.url));
const edd = JSON.parse(
  readFileSync(path.join(here, "../../edd/fixtures/reel.edd.json"), "utf8"),
) as EDD;

const dag = compile(edd, { toolVersions: { ffmpeg: "8.1.1", remotion: "4.0" } });

const ctx: ToolContext = {
  projectDir: "<project>",
  width: 1080,
  height: 1920,
  fps: 60,
  // NVIDIA present (-> NVENC) but native compositor unhealthy (-> PNG-seq fallback, ADR-0006)
  capabilities: { gpu: { nvidia: true }, remotionCompositor: "unhealthy" },
  resolveInput: (id) => `<${id}>`,
};

console.log(`\nEDD ${edd.id} -> ${dag.nodes.length}-node execution DAG (root: ${dag.rootId})\n`);

for (const plan of planDAG(dag.nodes, ctx)) {
  const node = dag.nodes.find((n) => n.id === plan.nodeId)!;
  console.log(`● ${plan.nodeId}  [${node.op}, ${node.resource}]  key=${node.key.slice(0, 12)}…`);
  if (plan.kind === "ffmpeg") {
    console.log(`    ffmpeg ${plan.args.join(" ")}\n`);
  } else {
    console.log(`    remotion(${plan.mode}) ${plan.cliArgs.join(" ")}`);
    if (plan.assembleArgs) console.log(`    assemble: ffmpeg ${plan.assembleArgs.join(" ")}`);
    console.log("");
  }
}
