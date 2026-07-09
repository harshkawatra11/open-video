/**
 * OpenVideo MCP tools — library_search / library_insert (doc 24, ADR-0010). Lets the agent browse
 * copyright-safe assets (fonts/b-roll/music/SFX/images/looks) and drop one into a project, mirroring
 * the daemon's HTTP library routes exactly (same registry, same provenance rules) so manual (HTTP) and
 * agentic (MCP) insertion behave identically.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { openProject, loadEdd, saveEdd, addLibraryAsset } from "@openvideo/project";
import path from "node:path";
import type { McpContext } from "../context.ts";
import { jsonResult, errorResult } from "../result.ts";

const KIND = z.enum(["font", "broll", "music", "sfx", "image", "look"]);

export function registerLibraryTools(server: McpServer, ctx: McpContext): void {
  server.registerTool(
    "library_search",
    {
      title: "Search the copyright-safe asset library",
      description:
        "Searches fonts/b-roll/music/SFX/images/looks across every enabled provider (keyless providers are always on; key-gated ones only if a key is configured). Every hit carries its provider id and license — never scraped media.",
      inputSchema: { kind: KIND, q: z.string().optional(), tags: z.array(z.string()).optional() },
    },
    async ({ kind, q, tags }) => {
      const hits = await ctx.registry.search(kind, { q, tags });
      return jsonResult({ hits });
    },
  );

  server.registerTool(
    "library_insert",
    {
      title: "Insert a library asset into a project",
      description:
        "Fetches an asset (by providerId + id from library_search) into the project's assets with provenance recorded, and best-effort patches the current EDD: font -> caption track fontRef, music -> audio track music, sfx -> audio track sfx cue at atS, otherwise added as a bare Source for you to reference in a subsequent edd_apply_patch.",
      inputSchema: {
        projectId: z.string(),
        providerId: z.string(),
        id: z.string(),
        atS: z.number().optional().describe("For sfx: the cue time in seconds."),
      },
    },
    async ({ projectId, providerId, id, atS }) => {
      const proj = openProject(ctx.projectsDir, projectId);
      const provider = ctx.registry.get(providerId);
      if (!provider) return errorResult(`unknown provider "${providerId}"`);
      try {
        const tmpName = `${providerId}-${id}`.replace(/[^\w.\-]/g, "_");
        const tmpDest = path.join(proj.dir, "downloads", tmpName);
        const file = await provider.fetch(id, tmpDest);
        const origin = provider.capabilities.generate ? "generated" : "provider";
        const source = addLibraryAsset(proj, file.path, {
          providerId,
          origin,
          license: file.license,
          attribution: file.attribution,
        });

        const edd = loadEdd(proj);
        if (edd) {
          if (provider.kind === "font") {
            const captionTrack = edd.timeline.tracks.find((t) => t.kind === "captions");
            if (captionTrack && captionTrack.kind === "captions") captionTrack.fontRef = id;
          } else if (provider.kind === "music") {
            const audioTrack = edd.timeline.tracks.find((t) => t.kind === "audio");
            if (audioTrack && audioTrack.kind === "audio") {
              audioTrack.music = { src: source.id, providerId, license: file.license, attribution: file.attribution };
            }
          } else if (provider.kind === "sfx") {
            const audioTrack = edd.timeline.tracks.find((t) => t.kind === "audio");
            if (audioTrack && audioTrack.kind === "audio") {
              audioTrack.sfx = [...(audioTrack.sfx ?? []), { cue: source.id, atS: atS ?? 0, providerId, license: file.license }];
            }
          } else {
            edd.sources.push(source);
          }
          saveEdd(proj, edd);
        }
        return jsonResult({ source, eddPatched: Boolean(edd) });
      } catch (e) {
        return errorResult(`library_insert failed: ${(e as Error).message}`);
      }
    },
  );
}
