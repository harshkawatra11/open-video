/**
 * OpenVideo — local AI-image provider (doc 24 §6). Keyless, but only meaningfully enabled once a
 * local image model is actually present on the machine — that detection belongs to the installer/
 * hardware-profile layer, not here, so this provider takes a `generate` function; when omitted (no
 * local model wired yet) it reports `capabilities.generate: false` and `fetch` throws honestly rather
 * than pretending to produce an image.
 */

import path from "node:path";
import fs from "node:fs";
import { createHash } from "node:crypto";
import type { AssetFile, AssetHit, PreviewRef, Provider, SearchQuery } from "../types.ts";

export type LocalImageGenerator = (prompt: string) => Promise<Buffer>;

export function createLocalImageProvider(generate?: LocalImageGenerator): Provider {
  return {
    id: "local-image",
    kind: "image",
    auth: { type: "none" },
    license: "Generated locally — subject to the local model's license/terms",
    capabilities: { search: false, preview: false, fetch: Boolean(generate), generate: Boolean(generate) },
    async search(_q: SearchQuery): Promise<AssetHit[]> {
      return []; // generative, not a searchable catalog
    },
    async preview(id: string): Promise<PreviewRef> {
      return { url: `openvideo://local-image/${encodeURIComponent(id)}/preview.png`, mime: "image/png" };
    },
    async fetch(id: string, dest: string): Promise<AssetFile> {
      if (!generate) {
        throw new Error("local-image: no local image model is installed — see Settings → Installer.");
      }
      const bytes = await generate(id);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, bytes);
      return {
        path: dest,
        hash: createHash("sha256").update(bytes).digest("hex"),
        license: "generated-local",
      };
    },
  };
}
