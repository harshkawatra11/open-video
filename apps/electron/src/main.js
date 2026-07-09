/**
 * OpenVideo Electron shell (ADR-0001, CLAUDE.md invariant 3: the daemon is the only privileged
 * process). This main process does exactly two things: spawn the daemon and load its served UI in a
 * BrowserWindow — it never touches the filesystem/network itself, matching the "renderer/shell act
 * only through the daemon" invariant.
 *
 * The daemon is spawned via `ELECTRON_RUN_AS_NODE=1`, which makes Electron's own bundled binary
 * behave as a plain Node.js interpreter — so a PACKAGED app needs no separate Node.js install on the
 * end user's machine (the same class of "resolve the real interpreter, don't assume it's on PATH"
 * concern documented in cli-adapter's resolveClaudeBin, solved here by not depending on an external
 * Node at all).
 *
 * CURRENT SCOPE: loads the daemon's static cockpit fallback (apps/cockpit/public), NOT the full
 * Next.js Studio app — Studio needs its own server (dynamic routes, not statically exportable as-is),
 * so wiring it in requires either a daemon-served static Studio export or a second managed
 * `next start` process. Left as an honest follow-up rather than a half-working attempt.
 */

const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const DAEMON_ENTRY = path.resolve(__dirname, "../../daemon/src/server.ts");
const PORT = process.env.OPENVIDEO_PORT || "7777";
const HEALTH_URL = `http://localhost:${PORT}/health`;

let daemonProcess = null;

function spawnDaemon() {
  daemonProcess = spawn(process.execPath, [DAEMON_ENTRY], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  });
  daemonProcess.on("error", (e) => console.error("[electron] failed to spawn daemon:", e));
}

function waitForHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      const req = http.get(HEALTH_URL, (res) => {
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on("error", retry);
      function retry() {
        if (Date.now() > deadline) return reject(new Error(`daemon did not become healthy within ${timeoutMs}ms`));
        setTimeout(attempt, 300);
      }
    }
    attempt();
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    backgroundColor: "#050506", // Obsidian jet-black canvas (doc 22) — avoid a white flash on load
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false, // the renderer gets NO privileged access — only the daemon does (ADR-0008)
      sandbox: true,
    },
  });
  await win.loadURL(`http://localhost:${PORT}/`);
}

app.whenReady().then(async () => {
  spawnDaemon();
  try {
    await waitForHealth(15_000);
  } catch (e) {
    console.error("[electron]", e.message);
  }
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (daemonProcess) daemonProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (daemonProcess) daemonProcess.kill();
});
