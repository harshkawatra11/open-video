/**
 * Minimal PCM16 mono WAV writer — no ffmpeg/deps needed. Used by the bundled starter music/SFX
 * providers to synthesize real, playable placeholder audio (a soft sine tone) until licensed
 * royalty-free packs are dropped in under the same catalog shape.
 */

export function synthSineWav(opts: { freqHz: number; durationS: number; sampleRate?: number; amplitude?: number }): Buffer {
  const sampleRate = opts.sampleRate ?? 44100;
  const amplitude = opts.amplitude ?? 0.2;
  const numSamples = Math.round(sampleRate * opts.durationS);
  const dataSize = numSamples * 2;

  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeMs = Math.min(0.05, opts.durationS / 4);
    const fade = Math.min(1, t / fadeMs, (opts.durationS - t) / fadeMs);
    const sample = amplitude * Math.max(0, fade) * Math.sin(2 * Math.PI * opts.freqHz * t);
    buf.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buf;
}
