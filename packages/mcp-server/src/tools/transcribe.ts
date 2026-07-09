/**
 * OpenVideo MCP tool — transcribe_source (doc 06 heavy tier, PRD §11). Runs real faster-whisper
 * word-level transcription on a project's source, saves the plain-text transcript (which
 * analyze_footage also reads) and best-effort patches the EDD's caption track with real word timings
 * — never fabricates timings if the heavy-tier dependency isn't installed yet.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fs from "node:fs";
import path from "node:path";
import { openProject, loadEdd, saveEdd } from "@openvideo/project";
import { transcribe } from "@openvideo/transcribe";
import type { McpContext } from "../context.ts";
import { jsonResult, errorResult } from "../result.ts";

export function registerTranscribeTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "transcribe_source",
    {
      title: "Transcribe a project's source with real word-level timings",
      description:
        "Runs faster-whisper (installer heavy tier) on a source's audio to produce real word-level timings — feeds caption tracks and analyze_footage. Requires the heavy-tier Python/faster-whisper dependency; if it isn't installed yet, this returns a clear error naming what to approve in Settings → Installer rather than fabricating a transcript.",
      inputSchema: {
        projectId: z.string(),
        sourceId: z.string().optional(),
        model: z.string().optional().describe('faster-whisper model size, e.g. "tiny"|"base"|"small". Default "base".'),
      },
    },
    async ({ projectId, sourceId, model }) => {
      const proj = openProject(ctx.projectsDir, projectId);
      const edd = loadEdd(proj);
      if (!edd) return errorResult(`project "${projectId}" has no EDD yet.`);
      const id = sourceId ?? edd.sources[0]?.id;
      const source = edd.sources.find((s) => s.id === id);
      if (!source) return errorResult(`no source "${id}" on this project.`);
      const videoPath = path.join(proj.dir, source.path);

      try {
        const words = await transcribe(videoPath, model ? { model } : {});

        const transcriptsDir = path.join(proj.dir, "transcripts");
        fs.mkdirSync(transcriptsDir, { recursive: true });
        fs.writeFileSync(path.join(transcriptsDir, `${id}.txt`), words.map((w) => w.t).join(" "));

        const captionTrack = edd.timeline.tracks.find((t) => t.kind === "captions");
        if (captionTrack && captionTrack.kind === "captions") {
          captionTrack.words = words;
          saveEdd(proj, edd);
        }

        return jsonResult({ sourceId: id, wordCount: words.length, eddPatched: Boolean(captionTrack), preview: words.slice(0, 12) });
      } catch (e) {
        return errorResult(`transcribe_source failed: ${(e as Error).message}`);
      }
    },
  );
}
