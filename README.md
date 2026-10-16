# FlashBack Studio

> **AI-developed project.** This application was designed and written end-to-end by Doubao (ByteDance) under human direction. It is an independent, third-party desktop editor for recordings made by the [Flashback](https://github.com/Moulberry/Flashback) Minecraft mod.

A standalone desktop video-editor (in the spirit of CapCut / Premiere Pro / Final Cut Pro) for editing Flashback Minecraft recordings — **without launching Minecraft**. You import `.zip` replays, arrange them on a multi-track timeline, adjust render settings, and export the result back to Flashback's native format for final video rendering in-game.

## Why standalone?

The built-in Flashback editor runs inside Minecraft, which consumes GPU/CPU and makes precise editing feel laggy. FlashBack Studio moves the editing experience out to a native desktop app:

- Edit, scrub, and arrange clips while Minecraft stays closed.
- Project files (`.fbproj`) live wherever you want — not buried in `.minecraft/`.
- Replay `.zip` files are copied into your project's own media folder, so you can reorganize and version projects independently.
- Only the final render/export step hands off to Minecraft + Flashback.

## Features

- **Standalone `.fbproj` project files** — New / Open / Save / Save As.
- **Import any Flashback `.zip`** regardless of Minecraft version. Reads `metadata.json`, detects `version_string` / `data_version` / `protocol_version`, skips unknown (`*optional`) actions gracefully.
- **Multi-track timeline** with replay clips, 11 keyframe tracks (Camera, Orbit, Track Entity, FOV, Speed/Tickrate, Timelapse, Freeze, Time of Day, Camera Shake, Audio, Block Override), Markers, ruler, playhead, zoom.
- **Inspector** mirrors Flashback's `ReplayVisuals`: chat, boss bar, hotbar, nametags, particles, sky, fog, FOV override, aspect ratio, guides.
- **Bilingual UI** — Traditional Chinese / English toggle (View menu or top-right button).
- **NLE shortcuts**: `Space` play/pause, `J/K/L` jog, `←/→` step, `Shift+←/→` step 10, `V` select, `C` razor, `Ctrl+S` save.
- **Export to Flashback** writes native `editor_states/<uuid>.json` for in-game rendering.

## Quick start

1. **New Project** (Ctrl+N) — choose where to save the `.fbproj`.
2. **Import Replay…** (Ctrl+I) — select one or more `.zip` recordings. They are copied into `<project>_media/`.
3. Click a clip in the left library to preview it on the timeline.
4. Adjust render settings in the right Inspector.
5. Set export range (start/end tick, FPS).
6. **Set Minecraft Folder…** once, then **Export to Flashback** (Ctrl+E).
7. Open Minecraft → Flashback → open the replay → render your video.

## Recording file format (reverse-engineered for interoperability)

A Flashback replay is a `.zip` containing:

```
metadata.json            # FlashbackMeta (uuid, name, version_string, chunks{}, markers{}, total_ticks)
icon.png                 # optional thumbnail
c0.flashback             # binary chunk packet stream
c1.flashback
...
level_chunk_cache(es)/   # cached chunk data
```

Each `cN.flashback` binary: `int32` magic `0xD780E884` (big-endian) → varint action dictionary → int32 snapshot size + snapshot stream → data stream of `varint id`, `int32 size`, payload.

## Develop

```powershell
npm install
npm start
```

## Credits & legal

- Flashback mod © 2024 Moulberry. This project is **not affiliated** with Moulberry.
- This repository's own code is MIT. It contains **no** copied source from the Flashback mod.
- **Written by AI (Doubao).**
