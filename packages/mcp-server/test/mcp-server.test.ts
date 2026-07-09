import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createOpenVideoMcpServer } from "../src/index.ts";
import { createProject, ingestAsset, scaffoldEdd, saveEdd } from "@openvideo/project";
import { execSync } from "node:child_process";

function tmpWorkdir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ov-mcp-"));
  process.env.OPENVIDEO_WORKDIR = dir;
  return dir;
}

async function connectedClient(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createOpenVideoMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, close: async () => client.close() };
}

function makeRealClipProject(workdir: string): string {
  const projectsDir = path.join(workdir, "projects");
  const proj = createProject(projectsDir, { name: "mcp-test" });
  const clipPath = path.join(workdir, "clip.mp4");
  execSync(
    `ffmpeg -y -f lavfi -i "testsrc=size=360x640:rate=30:duration=1" -f lavfi -i "sine=frequency=440:duration=1" -c:v libx264 -c:a aac -shortest "${clipPath}"`,
    { stdio: "ignore" },
  );
  return proj.id;
}

test("lists all OpenVideo tools", async () => {
  tmpWorkdir();
  const { client, close } = await connectedClient();
  try {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    assert.deepEqual(names, [
      "analyze_footage",
      "edd_apply_patch",
      "edd_get",
      "edd_render",
      "library_insert",
      "library_search",
      "project_get",
      "transcribe_source",
    ]);
  } finally {
    await close();
  }
});

test("edd_get returns an error result for a project with no EDD yet", async () => {
  const workdir = tmpWorkdir();
  const { createProject: cp } = await import("@openvideo/project");
  const proj = cp(path.join(workdir, "projects"), { name: "empty" });
  const { client, close } = await connectedClient();
  try {
    const result = await client.callTool({ name: "edd_get", arguments: { projectId: proj.id } });
    assert.equal(result.isError, true);
    assert.match((result.content as any)[0].text, /has no EDD yet/);
  } finally {
    await close();
  }
});

test("edd_get -> edd_apply_patch -> edd_get round-trips a real change", async () => {
  const workdir = tmpWorkdir();
  const projectsDir = path.join(workdir, "projects");
  const proj = createProject(projectsDir, { name: "roundtrip" });
  const clipPath = path.join(workdir, "clip.mp4");
  execSync(
    `ffmpeg -y -f lavfi -i "testsrc=size=360x640:rate=30:duration=1" -f lavfi -i "sine=frequency=440:duration=1" -c:v libx264 -c:a aac -shortest "${clipPath}"`,
    { stdio: "ignore" },
  );
  const source = await ingestAsset(proj, clipPath);
  const edd = scaffoldEdd(source.id, source.probe, source.path);
  saveEdd(proj, edd);

  const { client, close } = await connectedClient();
  try {
    const got = await client.callTool({ name: "edd_get", arguments: { projectId: proj.id } });
    const gotEdd = JSON.parse((got.content as any)[0].text);
    assert.equal(gotEdd.id, edd.id);

    gotEdd.project.platform = "tiktok";
    const patched = await client.callTool({
      name: "edd_apply_patch",
      arguments: { projectId: proj.id, edd: JSON.stringify(gotEdd) },
    });
    assert.notEqual(patched.isError, true);

    const after = await client.callTool({ name: "edd_get", arguments: { projectId: proj.id } });
    const afterEdd = JSON.parse((after.content as any)[0].text);
    assert.equal(afterEdd.project.platform, "tiktok");
  } finally {
    await close();
  }
});

test("edd_apply_patch rejects an invalid EDD with diagnostics, does not save it", async () => {
  const workdir = tmpWorkdir();
  const projectsDir = path.join(workdir, "projects");
  const proj = createProject(projectsDir, { name: "invalid-patch" });
  const clipPath = path.join(workdir, "clip.mp4");
  execSync(
    `ffmpeg -y -f lavfi -i "testsrc=size=360x640:rate=30:duration=1" -f lavfi -i "sine=frequency=440:duration=1" -c:v libx264 -c:a aac -shortest "${clipPath}"`,
    { stdio: "ignore" },
  );
  const source = await ingestAsset(proj, clipPath);
  const edd = scaffoldEdd(source.id, source.probe, source.path);
  saveEdd(proj, edd);

  const { client, close } = await connectedClient();
  try {
    const result = await client.callTool({
      name: "edd_apply_patch",
      arguments: { projectId: proj.id, edd: JSON.stringify({ not: "an edd" }) },
    });
    assert.equal(result.isError, true);

    const after = await client.callTool({ name: "edd_get", arguments: { projectId: proj.id } });
    const afterEdd = JSON.parse((after.content as any)[0].text);
    assert.equal(afterEdd.id, edd.id); // unchanged
  } finally {
    await close();
  }
});

test("edd_render actually compiles and renders a real MP4 via the DAG executor", async () => {
  const workdir = tmpWorkdir();
  const projectId = makeRealClipProject(workdir);
  const projectsDir = path.join(workdir, "projects");
  const { openProject } = await import("@openvideo/project");
  const proj = openProject(projectsDir, projectId);
  const source = await ingestAsset(proj, path.join(workdir, "clip.mp4"));
  const edd = scaffoldEdd(source.id, source.probe, source.path);
  saveEdd(proj, edd);

  const { client, close } = await connectedClient();
  try {
    // Real renders can legitimately take a while under load (this machine runs many real-binary
    // integration tests in parallel across packages) — the MCP SDK's default request timeout
    // (60s) is a transport-layer concern, not a signal about render correctness, so it's raised
    // here rather than in the tool itself.
    const result = await client.callTool({ name: "edd_render", arguments: { projectId } }, undefined, { timeout: 180_000 });
    assert.notEqual(result.isError, true);
    const parsed = JSON.parse((result.content as any)[0].text);
    assert.equal(parsed.ok, true);
    assert.ok(fs.existsSync(parsed.output), `expected rendered file at ${parsed.output}`);
  } finally {
    await close();
  }
});

test("library_search returns real bundled-sfx hits with license/provenance", async () => {
  tmpWorkdir();
  const { client, close } = await connectedClient();
  try {
    const result = await client.callTool({ name: "library_search", arguments: { kind: "sfx", q: "pop" } });
    const parsed = JSON.parse((result.content as any)[0].text);
    assert.ok(parsed.hits.length >= 1);
    assert.equal(parsed.hits[0].providerId, "bundled-sfx");
    assert.ok(parsed.hits[0].license);
  } finally {
    await close();
  }
});

test("library_insert fetches a real asset and patches the EDD music track", async () => {
  const workdir = tmpWorkdir();
  const projectId = makeRealClipProject(workdir);
  const projectsDir = path.join(workdir, "projects");
  const { openProject } = await import("@openvideo/project");
  const proj = openProject(projectsDir, projectId);
  const source = await ingestAsset(proj, path.join(workdir, "clip.mp4"));
  const edd = scaffoldEdd(source.id, source.probe, source.path);
  saveEdd(proj, edd);

  const { client, close } = await connectedClient();
  try {
    const result = await client.callTool({
      name: "library_insert",
      arguments: { projectId, providerId: "bundled-music", id: "uplift-loop-01" },
    });
    assert.notEqual(result.isError, true);
    const parsed = JSON.parse((result.content as any)[0].text);
    assert.equal(parsed.source.providerId, "bundled-music");
    assert.ok(fs.existsSync(path.join(proj.dir, parsed.source.path)));

    const after = await client.callTool({ name: "edd_get", arguments: { projectId } });
    const afterEdd = JSON.parse((after.content as any)[0].text);
    const audioTrack = afterEdd.timeline.tracks.find((t: any) => t.kind === "audio");
    assert.equal(audioTrack.music.providerId, "bundled-music");
  } finally {
    await close();
  }
});

test("project_get returns metadata + manifest + hasEdd", async () => {
  const workdir = tmpWorkdir();
  const projectsDir = path.join(workdir, "projects");
  const proj = createProject(projectsDir, { name: "summary-test" });

  const { client, close } = await connectedClient();
  try {
    const result = await client.callTool({ name: "project_get", arguments: { projectId: proj.id } });
    const parsed = JSON.parse((result.content as any)[0].text);
    assert.equal(parsed.name, "summary-test");
    assert.equal(parsed.hasEdd, false);
    assert.deepEqual(parsed.assets, []);
  } finally {
    await close();
  }
});

test("transcribe_source surfaces an honest error when faster-whisper isn't installed (never fabricates a transcript)", async () => {
  const workdir = tmpWorkdir();
  const projectId = makeRealClipProject(workdir);
  const projectsDir = path.join(workdir, "projects");
  const { openProject } = await import("@openvideo/project");
  const proj = openProject(projectsDir, projectId);
  const source = await ingestAsset(proj, path.join(workdir, "clip.mp4"));
  const edd = scaffoldEdd(source.id, source.probe, source.path);
  saveEdd(proj, edd);

  const { client, close } = await connectedClient();
  try {
    const result = await client.callTool({ name: "transcribe_source", arguments: { projectId } });
    assert.equal(result.isError, true);
    assert.match((result.content as any)[0].text, /faster-whisper|not installed/i);
  } finally {
    await close();
  }
});
