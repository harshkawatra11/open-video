# Appendix D — Data schema reference

Authoritative shapes for OpenVideo's durable models (PRD §13). Shown as annotated JSON / JSON-Schema
sketches; the implementation lives in `packages/edd` (types + validators). All models carry
`schemaVersion` and are git-versioned.

---

## 1. EDD (Video AST) — `timelines/<id>.edd.json`
See PRD §13.2 for the full worked example. Top-level keys:
```
schemaVersion : string            # "1.0"
id            : string            # "edd_<uuid>"
project       : { id, width, height, fps, colorSpace, platform, styleRef }
sources[]     : { id, path, hash, probe:{durationS,w,h,fps,vcodec,acodec,color} }
timeline      : { durationS, tracks[] }
  tracks[]    : oneOf:
     video/aroll : { id, kind:"video", clips[], transitions[], effects[] }
       clips[]      : { id, src, inS, outS, transform:{scale,position,crop,speed,punchIn} }
       transitions[]: { between:[clipId,clipId], type, durationS, ease }
       effects[]    : { type:"color|denoise|sharpen|vignette", spec:{...} }
     captions    : { id, kind:"captions", styleRef, words[]:{t,startS,endS,emph} }
     graphics    : { id, kind:"graphics", items[]:{id,component,props,startS,endS} }
     audio       : { id, kind:"audio", voice:{chain[],loudness:{targetLUFS,tpDb}},
                     music:{src,targetLUFS,duck}, sfx[]:{cue,atS} }
export        : { container, vcodec, acodec, w, h, fps, crf, faststart, preset }
provenance[]  : { node, by, why }   # which agent authored which node and why
```
Invariants (validation pass): monotonic, non-overlapping clip times per track; in/out within source
bounds; resolvable `src`/`styleRef`/`component`; caption timings within safe margins; sane export.

## 2. Project manifest — `project.json`
```
{ id, name, createdAt, platform, width, height, fps, styleRef, currentEdd, assets }
```

## 3. Transcript — `transcripts/<asset>.json`
```
{ asset, language, model, device, authoritative:boolean,
  segments[]: { startS, endS, text, words[]: { t, startS, endS, conf } } }
```

## 4. Blueprint / plan — `plans/<id>.plan.json`
```
{ schemaVersion, id, spine, sections[]:{ timestampS, line, camera, zoomPct, transition,
  overlays[], captions, sfx[], broll, color }, hookPlan, brollList[], graphicsList[],
  captionStyle, audioPlan, colorPlan, exportTarget }
```

## 5. Asset manifest — `assets/manifest.json`
```
[ { id, path, hash, probe:{...}, proxies:{ preview } } ]
```

## 6. Cache index — `cache/index.json`
```
{ "<cacheKey>": { node, op, output, createdAt, toolVersions:{...} } }
cacheKey = sha256(op + resolvedInputs + params + toolVersions)
```

## 7. Render record — `renders/<id>.json`
```
{ id, eddVersion(gitSha), createdAt, quality:"preview|final", outputs[], toolVersions, verify:{
  width, height, fps, vcodec, acodec, integratedLUFS, truePeakDb } }
```

## 8. STYLE (look) system — `STYLE.md` (markdown with structured sections)
Sections (each parseable):
```
identity/voice ; palette{ bg, fg, accent, ... } ; typography{ display, body } ;
caption{ size, weight, highlight, emphasisTreatment, safeMarginPx } ;
motion{ eases, durationsMs, punchInAmplitude } ; pacing{ maxStaticFrameS } ;
audio{ targetLUFS, truePeakDb } ; grade{ defaults, antiPatterns[] } ;
broll{ policy } ; antiPatterns[]
```
Lowering (PRD §12.4) resolves EDD style refs against these values.

## 9. Plugin manifest — `openvideo.json`
```
{ name, version,
  type: "agent|skill|caption-style|transition|template|animation-pack|look-system|renderer|
         music-provider|importer|cloud-render",
  entry, capabilities[]:  // e.g. "edd:patch","remotion:component","render:engine","net:fetch"
  permissions[]:          // e.g. "fs:project-read","fs:project-write","net:proxy"
  params:{...},           // apply-time configuration
  dependencies[]:{ tool, min }, preview, license }
```

## 10. Edit/Session protocol message families (PRD §8.7)
```
session.* (start|resume|interrupt) ; intent.submit ; plan.(propose|approve|amend|reject) ;
edd.(get|patch|diff|history) ; render.(request|progress|cancel) ; install.(status|approve) ;
control.(model|effort|mode|permission) ; usage.delta ; agent.(thinking|message|tool_use|
tool_result|result|error)
```

---
All schemas are versioned; migrations are explicit (PRD §13.8). JSON Schemas are the source of truth
in `packages/edd` and `packages/shared`; this appendix is the human-readable summary.
