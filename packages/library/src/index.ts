export * from "./types.ts";
export * from "./registry.ts";
export * from "./keystore.ts";
export * from "./wav.ts";
export * from "./providers/google-fonts.ts";
export * from "./providers/vector-broll.ts";
export * from "./providers/bundled-audio.ts";
export * from "./providers/bundled-looks.ts";
export * from "./providers/local-image.ts";
export * from "./providers/key-gated.ts";

import type { KeyResolver } from "./types.ts";
import { ProviderRegistry } from "./registry.ts";
import { createGoogleFontsProvider } from "./providers/google-fonts.ts";
import { createVectorBrollProvider } from "./providers/vector-broll.ts";
import { createBundledMusicProvider, createBundledSfxProvider } from "./providers/bundled-audio.ts";
import { createBundledLooksProvider } from "./providers/bundled-looks.ts";
import { createLocalImageProvider, type LocalImageGenerator } from "./providers/local-image.ts";
import {
  createPexelsProvider,
  createPixabayProvider,
  createFreesoundProvider,
  createFreeMusicArchiveProvider,
  createHostedImageProvider,
} from "./providers/key-gated.ts";

/** Builds the full default registry (doc 24 §2): every keyless provider active, every key-gated
 *  provider registered-but-disabled until `resolveKey` returns a value for its keyId. */
export function createDefaultRegistry(opts: {
  resolveKey?: KeyResolver;
  localImageGenerator?: LocalImageGenerator;
} = {}): ProviderRegistry {
  const resolveKey = opts.resolveKey ?? (() => undefined);
  const registry = new ProviderRegistry(resolveKey);

  registry.register(createGoogleFontsProvider());
  registry.register(createVectorBrollProvider());
  registry.register(createBundledMusicProvider());
  registry.register(createBundledSfxProvider());
  registry.register(createBundledLooksProvider());
  registry.register(createLocalImageProvider(opts.localImageGenerator));

  registry.register(createPexelsProvider(resolveKey));
  registry.register(createPixabayProvider(resolveKey));
  registry.register(createFreesoundProvider(resolveKey));
  registry.register(createFreeMusicArchiveProvider(resolveKey));
  registry.register(createHostedImageProvider(resolveKey));

  return registry;
}
