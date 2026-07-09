import { Config } from "@remotion/cli/config";

// PNG (not jpeg) — Overlay must render with an alpha channel so it composites
// cleanly over the graded a-roll in ffmpeg. See CLAUDE.md "Remotion compositor crash".
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setConcurrency(null); // auto
