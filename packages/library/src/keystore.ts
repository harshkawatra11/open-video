/**
 * OpenVideo — encrypted local keystore for provider API keys (ADR-0008: secrets never reach the
 * renderer/agents; ADR-0010: key-gated providers are inactive until a key is present). AES-256-GCM at
 * rest; the machine key is a random file generated on first use and chmod-restricted where supported.
 * This is intentionally the *only* place in the library package that touches crypto.
 */

import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function machineKey(dir: string): Buffer {
  const keyPath = path.join(dir, ".keystore.key");
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(keyPath)) {
    fs.writeFileSync(keyPath, randomBytes(32));
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch {
      /* best-effort on platforms without POSIX perms (e.g. Windows) */
    }
  }
  return fs.readFileSync(keyPath);
}

export interface Keystore {
  get(keyId: string): string | undefined;
  set(keyId: string, value: string): void;
  delete(keyId: string): void;
  list(): string[];
}

/** Opens (creating if absent) an encrypted keystore rooted at `dir` (typically WORKDIR/keystore). */
export function openKeystore(dir: string): Keystore {
  const key = machineKey(dir);
  const storePath = path.join(dir, "keys.enc.json");

  function readStore(): Record<string, { iv: string; tag: string; data: string }> {
    if (!fs.existsSync(storePath)) return {};
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  }

  function writeStore(store: Record<string, { iv: string; tag: string; data: string }>): void {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  }

  return {
    get(keyId) {
      const store = readStore();
      const rec = store[keyId];
      if (!rec) return undefined;
      const decipher = createDecipheriv(ALGO, key, Buffer.from(rec.iv, "hex"));
      decipher.setAuthTag(Buffer.from(rec.tag, "hex"));
      try {
        const out = Buffer.concat([decipher.update(Buffer.from(rec.data, "hex")), decipher.final()]);
        return out.toString("utf8");
      } catch {
        return undefined; // tampered/corrupt entry — treat as absent, never throw into a provider check
      }
    },
    set(keyId, value) {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGO, key, iv);
      const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
      const tag = cipher.getAuthTag();
      const store = readStore();
      store[keyId] = { iv: iv.toString("hex"), tag: tag.toString("hex"), data: data.toString("hex") };
      writeStore(store);
    },
    delete(keyId) {
      const store = readStore();
      delete store[keyId];
      writeStore(store);
    },
    list() {
      return Object.keys(readStore());
    },
  };
}
