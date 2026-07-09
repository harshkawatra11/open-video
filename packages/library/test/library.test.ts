import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createDefaultRegistry,
  createGoogleFontsProvider,
  googleFontsCss2Url,
  createVectorBrollProvider,
  createBundledMusicProvider,
  createBundledSfxProvider,
  createBundledLooksProvider,
  createLocalImageProvider,
  openKeystore,
  synthSineWav,
  NotConfiguredError,
  createPexelsProvider,
} from "../src/index.ts";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "ov-library-"));
}

test("googleFontsCss2Url builds a valid CSS2 URL (pure, offline)", () => {
  const url = googleFontsCss2Url("Space Grotesk", [500, 700]);
  assert.match(url, /^https:\/\/fonts\.googleapis\.com\/css2\?/);
  assert.match(url, /family=Space\+Grotesk/);
  assert.match(url, /500/);
  assert.match(url, /700/);
});

test("google-fonts provider searches the offline starter catalog", async () => {
  const provider = createGoogleFontsProvider();
  const hits = await provider.search({ q: "inter" });
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.id, "Inter");
  assert.equal(hits[0]!.kind, "font");
});

test("vector-broll provider searches by tag and fetch writes a generation descriptor", async () => {
  const provider = createVectorBrollProvider();
  const hits = await provider.search({ tags: ["data"] });
  assert.ok(hits.length >= 2);

  const dir = tmpDir();
  const dest = path.join(dir, "asset.json");
  const file = await provider.fetch(hits[0]!.id, dest);
  assert.ok(fs.existsSync(dest));
  const descriptor = JSON.parse(fs.readFileSync(dest, "utf8"));
  assert.equal(descriptor.kind, "vector-broll");
  assert.equal(file.license, "generated");
});

test("bundled-music and bundled-sfx providers fetch real playable WAV bytes", async () => {
  const music = createBundledMusicProvider();
  const sfx = createBundledSfxProvider();
  const dir = tmpDir();

  const musicHits = await music.search({});
  const musicFile = await music.fetch(musicHits[0]!.id, path.join(dir, "m.wav"));
  const buf = fs.readFileSync(musicFile.path);
  assert.equal(buf.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(buf.subarray(8, 12).toString("ascii"), "WAVE");

  const sfxHits = await sfx.search({ tags: ["ui"] });
  assert.ok(sfxHits.every((h) => h.meta?.tags && (h.meta.tags as string[]).includes("ui")));
  const sfxFile = await sfx.fetch(sfxHits[0]!.id, path.join(dir, "s.wav"));
  assert.ok(fs.existsSync(sfxFile.path));
});

test("synthSineWav produces a header-valid WAV of the requested duration", () => {
  const wav = synthSineWav({ freqHz: 440, durationS: 0.5, sampleRate: 8000 });
  const dataSize = wav.readUInt32LE(40);
  assert.equal(dataSize, 8000 * 0.5 * 2);
});

test("bundled-looks provider fetch writes STYLE.md-shaped JSON", async () => {
  const provider = createBundledLooksProvider();
  const hits = await provider.search({ q: "gold" });
  assert.equal(hits.length, 1);
  const dir = tmpDir();
  const file = await provider.fetch(hits[0]!.id, path.join(dir, "look.json"));
  const style = JSON.parse(fs.readFileSync(file.path, "utf8"));
  assert.ok(style.palette);
});

test("local-image provider is honestly disabled with no generator wired", async () => {
  const provider = createLocalImageProvider();
  assert.equal(provider.capabilities.generate, false);
  await assert.rejects(() => provider.fetch("a prompt", path.join(tmpDir(), "img.png")), /no local image model/);
});

test("local-image provider fetches via an injected generator when present", async () => {
  const provider = createLocalImageProvider(async () => Buffer.from("fake-png-bytes"));
  assert.equal(provider.capabilities.generate, true);
  const dir = tmpDir();
  const file = await provider.fetch("a cinematic title card", path.join(dir, "img.png"));
  assert.ok(fs.existsSync(file.path));
});

test("keystore: set/get round-trips a secret encrypted at rest", () => {
  const dir = tmpDir();
  const ks = openKeystore(dir);
  assert.equal(ks.get("pexels"), undefined);
  ks.set("pexels", "sk-test-123");
  assert.equal(ks.get("pexels"), "sk-test-123");
  assert.ok(ks.list().includes("pexels"));

  const raw = fs.readFileSync(path.join(dir, "keys.enc.json"), "utf8");
  assert.ok(!raw.includes("sk-test-123"), "the raw keystore file must never contain the plaintext key");

  ks.delete("pexels");
  assert.equal(ks.get("pexels"), undefined);
});

test("key-gated provider throws NotConfiguredError with no key present", async () => {
  const provider = createPexelsProvider(() => undefined);
  await assert.rejects(() => provider.search({ q: "city" }), NotConfiguredError);
});

test("createDefaultRegistry: keyless providers enabled, key-gated providers disabled until keyed", () => {
  const registry = createDefaultRegistry();
  const fonts = registry.list("font");
  assert.equal(fonts.length, 1);
  assert.equal(fonts[0]!.enabled, true);

  const broll = registry.list("broll");
  const vector = broll.find((r) => r.provider.id === "vector-broll")!;
  const pexels = broll.find((r) => r.provider.id === "pexels")!;
  assert.equal(vector.enabled, true);
  assert.equal(pexels.enabled, false);

  const withKey = createDefaultRegistry({ resolveKey: (id) => (id === "pexels" ? "sk-abc" : undefined) });
  const pexelsEnabled = withKey.list("broll").find((r) => r.provider.id === "pexels")!;
  assert.equal(pexelsEnabled.enabled, true);
});

test("registry.search fans out across enabled providers of a kind and tags provenance", async () => {
  const registry = createDefaultRegistry();
  const hits = await registry.search("sfx", { q: "pop" });
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((h) => h.providerId === "bundled-sfx"));
  assert.ok(hits.every((h) => h.license));
});
