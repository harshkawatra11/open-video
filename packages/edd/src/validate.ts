/**
 * OpenVideo — EDD validation pass (PRD §12.5).
 *
 * Returns structured Diagnostics (errors block render; warnings are advisory lint). This is the
 * deterministic core the Validation agent wraps for explanation (PRD §9). Hand-rolled (zero deps)
 * so it runs under Node's native type-stripping; a JSON-Schema gate (schema/edd.schema.json) can be
 * layered in front of it later for structural checks.
 */

import type {
  EDD,
  Diagnostic,
  VideoTrack,
  CaptionTrack,
  GraphicsTrack,
  BrollTrack,
} from "./types.ts";

const LINT_MAX_STATIC_FRAME_S = 4; // PRD lint: "no static frame > 3-4s"

function err(code: string, path: string, message: string, suggestion?: string): Diagnostic {
  return suggestion === undefined
    ? { code, severity: "error", path, message }
    : { code, severity: "error", path, message, suggestion };
}
function warn(code: string, path: string, message: string, suggestion?: string): Diagnostic {
  return suggestion === undefined
    ? { code, severity: "warning", path, message }
    : { code, severity: "warning", path, message, suggestion };
}

/**
 * Validate an EDD. Errors mean the EDD must not be compiled/rendered; warnings are surfaced to the
 * user / Simulation / QA agents.
 */
export function validateEDD(edd: EDD): Diagnostic[] {
  const d: Diagnostic[] = [];

  if (!edd || typeof edd !== "object") {
    return [err("EDD000", "$", "EDD is not an object")];
  }
  if (!edd.schemaVersion) {
    d.push(err("EDD001", "schemaVersion", "missing schemaVersion"));
  }
  if (!edd.id) d.push(err("EDD002", "id", "missing EDD id"));

  // --- project ---
  const p = edd.project;
  if (!p) {
    d.push(err("EDD010", "project", "missing project metadata"));
  } else {
    if (!(p.width > 0)) d.push(err("EDD011", "project.width", "width must be > 0"));
    if (!(p.height > 0)) d.push(err("EDD012", "project.height", "height must be > 0"));
    if (!(p.fps > 0)) d.push(err("EDD013", "project.fps", "fps must be > 0"));
  }

  // --- sources ---
  const sourceIds = new Set<string>();
  if (!Array.isArray(edd.sources) || edd.sources.length === 0) {
    d.push(err("EDD020", "sources", "at least one source is required"));
  } else {
    edd.sources.forEach((s, i) => {
      if (!s.id) d.push(err("EDD021", `sources[${i}].id`, "source missing id"));
      else if (sourceIds.has(s.id))
        d.push(err("EDD022", `sources[${i}].id`, `duplicate source id "${s.id}"`));
      else sourceIds.add(s.id);
      if (!s.path) d.push(err("EDD023", `sources[${i}].path`, "source missing path"));
    });
  }

  // --- timeline ---
  const tl = edd.timeline;
  if (!tl || !Array.isArray(tl.tracks)) {
    d.push(err("EDD030", "timeline.tracks", "timeline.tracks must be an array"));
    return d; // can't go deeper meaningfully
  }
  if (!(tl.durationS > 0))
    d.push(warn("EDD031", "timeline.durationS", "timeline.durationS should be > 0"));

  const trackIds = new Set<string>();
  tl.tracks.forEach((t, ti) => {
    const base = `timeline.tracks[${ti}]`;
    if (!t.id) d.push(err("EDD032", `${base}.id`, "track missing id"));
    else if (trackIds.has(t.id)) d.push(err("EDD033", `${base}.id`, `duplicate track id "${t.id}"`));
    else trackIds.add(t.id);

    switch (t.kind) {
      case "video":
        validateVideoTrack(t, base, sourceIds, d);
        break;
      case "captions":
        validateCaptionTrack(t, base, tl.durationS, d);
        break;
      case "graphics":
        validateGraphicsTrack(t, base, tl.durationS, d);
        break;
      case "broll":
        validateBrollTrack(t, base, sourceIds, tl.durationS, d);
        break;
      case "audio":
        if (!t.voice?.loudness)
          d.push(
            warn(
              "EDD060",
              `${base}.voice.loudness`,
              "no loudness target set",
              "set a platform target, e.g. -14 LUFS for social",
            ),
          );
        break;
      default:
        d.push(err("EDD034", `${base}.kind`, `unknown track kind "${(t as { kind: string }).kind}"`));
    }
  });

  // --- export ---
  const ex = edd.export;
  if (!ex) d.push(err("EDD070", "export", "missing export spec"));
  else {
    if (!(ex.w > 0)) d.push(err("EDD071", "export.w", "export width must be > 0"));
    if (!(ex.h > 0)) d.push(err("EDD072", "export.h", "export height must be > 0"));
    if (!(ex.fps > 0)) d.push(err("EDD073", "export.fps", "export fps must be > 0"));
  }

  return d;
}

function validateVideoTrack(
  t: VideoTrack,
  base: string,
  sourceIds: Set<string>,
  d: Diagnostic[],
): void {
  const clipIds = new Set<string>();
  let prevOut = -Infinity;
  // clips are interpreted in array order along the track
  const sorted = [...t.clips];
  t.clips.forEach((c, ci) => {
    const cb = `${base}.clips[${ci}]`;
    if (!c.id) d.push(err("EDD040", `${cb}.id`, "clip missing id"));
    else clipIds.add(c.id);
    if (!sourceIds.has(c.src))
      d.push(err("EDD041", `${cb}.src`, `clip references unknown source "${c.src}"`));
    if (!(c.inS < c.outS))
      d.push(err("EDD042", `${cb}`, `clip inS (${c.inS}) must be < outS (${c.outS})`));
    if (c.inS < 0) d.push(err("EDD043", `${cb}.inS`, "clip inS must be >= 0"));
  });

  // overlap / monotonicity along the track (clips should not overlap in source-time order as laid)
  sorted.forEach((c, ci) => {
    if (c.inS < prevOut)
      d.push(
        err(
          "EDD044",
          `${base}.clips[${ci}]`,
          `clip overlaps the previous clip (inS ${c.inS} < previous outS ${prevOut})`,
        ),
      );
    prevOut = Math.max(prevOut, c.outS);
  });

  // lint: a single long static clip with no punch-in / transition
  t.clips.forEach((c, ci) => {
    const dur = c.outS - c.inS;
    const moving = c.transform?.punchIn || c.transform?.speed;
    if (dur > LINT_MAX_STATIC_FRAME_S && !moving)
      d.push(
        warn(
          "EDD045",
          `${base}.clips[${ci}]`,
          `static clip longer than ${LINT_MAX_STATIC_FRAME_S}s (${dur.toFixed(1)}s) with no motion`,
          "add a punch-in or a cut to avoid a dead stretch",
        ),
      );
  });

  // transitions must reference existing clips
  (t.transitions ?? []).forEach((tr, i) => {
    tr.between.forEach((cid) => {
      if (!clipIds.has(cid))
        d.push(
          err("EDD046", `${base}.transitions[${i}].between`, `transition references unknown clip "${cid}"`),
        );
    });
  });
}

function validateCaptionTrack(
  t: CaptionTrack,
  base: string,
  durationS: number,
  d: Diagnostic[],
): void {
  if (!Array.isArray(t.words) || t.words.length === 0) {
    d.push(warn("EDD050", `${base}.words`, "caption track has no words"));
    return;
  }
  let prevEnd = 0;
  t.words.forEach((w, wi) => {
    const wb = `${base}.words[${wi}]`;
    if (!(w.startS <= w.endS))
      d.push(err("EDD051", wb, `word startS (${w.startS}) must be <= endS (${w.endS})`));
    if (w.startS < prevEnd - 1e-6)
      d.push(warn("EDD052", wb, `word starts before the previous word ends (${w.startS} < ${prevEnd})`));
    if (durationS > 0 && w.endS > durationS + 1e-6)
      d.push(warn("EDD053", wb, `word ends after timeline duration (${w.endS} > ${durationS})`));
    prevEnd = Math.max(prevEnd, w.endS);
  });
}

function validateGraphicsTrack(
  t: GraphicsTrack,
  base: string,
  durationS: number,
  d: Diagnostic[],
): void {
  (t.items ?? []).forEach((g, gi) => {
    const gb = `${base}.items[${gi}]`;
    if (!g.component) d.push(err("EDD054", `${gb}.component`, "graphic item missing component"));
    if (!(g.startS < g.endS))
      d.push(err("EDD055", gb, `graphic startS (${g.startS}) must be < endS (${g.endS})`));
    if (durationS > 0 && g.endS > durationS + 1e-6)
      d.push(warn("EDD056", gb, `graphic ends after timeline duration (${g.endS} > ${durationS})`));
  });
}

function validateBrollTrack(
  t: BrollTrack,
  base: string,
  sourceIds: Set<string>,
  durationS: number,
  d: Diagnostic[],
): void {
  (t.clips ?? []).forEach((c, ci) => {
    const cb = `${base}.clips[${ci}]`;
    if (!c.id) d.push(err("EDD080", `${cb}.id`, "b-roll clip missing id"));
    if (!sourceIds.has(c.src))
      d.push(err("EDD081", `${cb}.src`, `b-roll clip references unknown source "${c.src}"`));
    if (!(c.inS < c.outS))
      d.push(err("EDD082", cb, `b-roll clip inS (${c.inS}) must be < outS (${c.outS})`));
    const [atStart, atEnd] = c.atS ?? [NaN, NaN];
    if (!(atStart < atEnd))
      d.push(err("EDD083", `${cb}.atS`, `b-roll placement start (${atStart}) must be < end (${atEnd})`));
    if (durationS > 0 && atEnd > durationS + 1e-6)
      d.push(warn("EDD084", `${cb}.atS`, `b-roll placement ends after timeline duration (${atEnd} > ${durationS})`));
    if (c.opacity !== undefined && (c.opacity < 0 || c.opacity > 1))
      d.push(err("EDD085", `${cb}.opacity`, `b-roll opacity must be in [0,1], got ${c.opacity}`));
  });
}

/** Convenience: true if the EDD has no error-severity diagnostics. */
export function isRenderable(edd: EDD): boolean {
  return validateEDD(edd).every((x) => x.severity !== "error");
}
