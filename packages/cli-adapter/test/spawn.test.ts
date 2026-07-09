import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildClaudeArgs, createLineBuffer, resolveClaudeBin } from "../src/index.ts";

test("buildClaudeArgs emits the headless stream-json invocation (Appendix C §1)", () => {
  const args = buildClaudeArgs({
    prompt: "make a reel",
    model: "claude-opus-4-8",
    resume: "sesn_abc",
    mcpConfigPath: "/p/.mcp.json",
    permissionMode: "plan",
    streamInput: true,
  });
  assert.ok(args.includes("-p"));
  assert.equal(args[args.indexOf("--output-format") + 1], "stream-json");
  assert.equal(args[args.indexOf("--input-format") + 1], "stream-json");
  assert.ok(args.includes("--verbose"));
  assert.equal(args[args.indexOf("--model") + 1], "claude-opus-4-8");
  assert.equal(args[args.indexOf("--resume") + 1], "sesn_abc");
  assert.equal(args[args.indexOf("--mcp-config") + 1], "/p/.mcp.json");
  assert.equal(args[args.indexOf("--permission-mode") + 1], "plan");
});

test("one-shot mode omits --input-format (so the CLI doesn't wait on stdin)", () => {
  const args = buildClaudeArgs({ prompt: "hi", model: "claude-haiku-4-5" });
  assert.ok(!args.includes("--input-format"));
});

test("effort maps to --effort when set, omitted otherwise", () => {
  const withEffort = buildClaudeArgs({ prompt: "p", model: "claude-opus-4-8", effort: "low" });
  assert.equal(withEffort[withEffort.indexOf("--effort") + 1], "low");
  const without = buildClaudeArgs({ prompt: "p", model: "claude-opus-4-8" });
  assert.ok(!without.includes("--effort"));
});

test("appendSystemPrompt and strictMcpConfig map to their flags when set", () => {
  const args = buildClaudeArgs({
    prompt: "p",
    model: "claude-opus-4-8",
    mcpConfigPath: "/p/.mcp.json",
    strictMcpConfig: true,
    appendSystemPrompt: "You are the Director.",
  });
  assert.ok(args.includes("--strict-mcp-config"));
  assert.equal(args[args.indexOf("--append-system-prompt") + 1], "You are the Director.");
});

test("appendSystemPrompt/strictMcpConfig omitted when not set", () => {
  const args = buildClaudeArgs({ prompt: "p", model: "claude-opus-4-8" });
  assert.ok(!args.includes("--strict-mcp-config"));
  assert.ok(!args.includes("--append-system-prompt"));
});

test("resolveClaudeBin follows a Windows .cmd shim to its real .exe target, never returning the shim itself", { skip: process.platform !== "win32" }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ov-cli-bin-"));
  const targetDir = path.join(dir, "node_modules", "@anthropic-ai", "claude-code", "bin");
  fs.mkdirSync(targetDir, { recursive: true });
  const exePath = path.join(targetDir, "claude.exe");
  fs.writeFileSync(exePath, ""); // stand-in binary; only existence is checked

  const shimPath = path.join(dir, "claude.cmd");
  fs.writeFileSync(
    shimPath,
    ['@ECHO off', 'GOTO start', ':find_dp0', 'SET dp0=%~dp0', 'EXIT /b', ':start', 'SETLOCAL', 'CALL :find_dp0', `"%dp0%\\node_modules\\@anthropic-ai\\claude-code\\bin\\claude.exe"   %*`].join("\r\n"),
  );
  // also drop an extensionless POSIX shebang shim alongside it, matching the real npm layout
  fs.writeFileSync(path.join(dir, "claude"), "#!/usr/bin/env node\n");

  const original = process.env.PATH;
  process.env.PATH = dir + path.delimiter + original;
  try {
    const resolved = resolveClaudeBin("claude");
    assert.equal(resolved.command, exePath);
    assert.deepEqual(resolved.argsPrefix, []);
  } finally {
    process.env.PATH = original;
  }
});

test("resolveClaudeBin follows a .cmd shim targeting a .js file via this Node binary", { skip: process.platform !== "win32" }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ov-cli-bin-js-"));
  fs.writeFileSync(path.join(dir, "cli.js"), "");
  fs.writeFileSync(path.join(dir, "claude.cmd"), `@ECHO off\r\nSETLOCAL\r\n"%dp0%\\cli.js" %*\r\n`);

  const original = process.env.PATH;
  process.env.PATH = dir + path.delimiter + original;
  try {
    const resolved = resolveClaudeBin("claude");
    assert.equal(resolved.command, process.execPath);
    assert.deepEqual(resolved.argsPrefix, [path.join(dir, "cli.js")]);
  } finally {
    process.env.PATH = original;
  }
});

test("createLineBuffer reassembles lines across chunk boundaries", () => {
  const lb = createLineBuffer();
  assert.deepEqual(lb.push('{"a":1}\n{"b":2}\n{"c"'), ['{"a":1}', '{"b":2}']);
  assert.deepEqual(lb.push(':3}\n'), ['{"c":3}']);
  assert.deepEqual(lb.push("   \n"), []); // whitespace-only lines dropped
  assert.deepEqual(lb.flush(), []);
});

test("createLineBuffer.flush returns a trailing partial line", () => {
  const lb = createLineBuffer();
  assert.deepEqual(lb.push('{"only":"partial"}'), []);
  assert.deepEqual(lb.flush(), ['{"only":"partial"}']);
});
