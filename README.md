# FlashBack Studio

> **AI-developed project.** This application was designed and written end-to-end by Doubao (ByteDance) under human direction. It is an independent, third-party desktop editor for recordings made by the [Flashback](https://github.com/Moulberry/Flashback) Minecraft mod.

A desktop, video-editor–style application (in the spirit of CapCut / Premiere Pro / Final Cut Pro) for editing recordings produced by the Flashback Minecraft mod. Instead of editing inside Minecraft, you get a proper multi-track timeline, an inspector panel, and a preview window — and save your work back into the exact `editor_states/*.json` files Flashback already reads, so the same project opens seamlessly in-game.

## Features

- **One-click import, no version picking.** Drop in any `.zip` replay recorded by Flashback on any Minecraft version. The editor reads `metadata.json`, detects `version_string` / `data_version` / `protocol_version`, and skips unknown (`*optional`) actions gracefully.
- **Media library** auto-scans `.minecraft/flashback/replays/` and every multi-instance folder under `.minecraft/versions/*/flashback/replays/`.
- **Multi-track timeline** with:
  - Replay clip track (chunks `c0.flashback` … `cN.flashback`, each with its own duration)
  - Keyframe tracks for Camera, Camera Orbit, Track Entity, FOV, Tickrate/Speed, Timelapse, Freeze, Time of Day, Camera Shake, Audio, Block Override
  - Markers track
  - Ruler, playhead, zoom (px/sec)
- **Inspector** mirrors Flashback's `ReplayVisuals`: show/hide chat, boss bar, hotbar, nametags, particles, sky, fog, FOV override, aspect ratio, guides, etc.
- **Two shortcut schemes built in**:
  - *Original Flashback / NLE*: `Space` play/pause, `J/K/L` jog, `←/→` step, `Shift+←/→` step 10, `Home/End`, `V` select, `C` razor, `Ctrl+S` save.
- **Preview pane** renders a top-down camera-path projection extracted from `accurate_player_position` actions, so you can see your camera movement without launching Minecraft.
- **Saves back to Flashback's own format** — `<gameDir>/flashback/editor_states/<replay-uuid>.json`. Open the same replay in-game and your edits are already there.

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

Each `cN.flashback` binary:

| offset | field |
|---|---|
| 0 | `int32` magic = `0xD780E884` (big-endian, Netty default) |
| 4 | `varint` N actions, then N × modified-UTF8 strings (action dictionary) |
| … | `int32` snapshot size, then snapshot action stream |
| … | data action stream: `varint id`, `int32 size`, `size` bytes payload |

Unknown actions whose name ends in `optional` are skipped (this is how the mod stays forward/backward compatible across Minecraft versions). This editor implements the same skip rule.

## Project layout

```
FlashBack Studio/
├── electron/              # main process (Node)
│   ├── main.ts            # Electron entry + IPC
│   ├── preload.ts         # context bridge
│   ├── replay/            # .zip / .flashback parser (magic, dictionary, chunks, camera path)
│   ├── state/             # editor_states/<uuid>.json read/write
│   ├── library/           # multi-instance replay scanner
│   └── export/
├── src/                   # React renderer (Vite)
│   ├── App.tsx            # CapCut/Pr-style layout
│   ├── components/tracks/
│   └── styles/
└── package.json
```

## Develop

```powershell
npm install
npm run dev        # renderer only (no Electron) — http://localhost:5173
npm start          # compile electron + launch desktop app
```

## Credits & legal

- Flashback mod © 2024 Moulberry. This project is **not affiliated** with Moulberry. It only reads and writes the on-disk file formats the mod already uses, for interoperability.
- This repository's own code is MIT. It contains **no** copied source from the Flashback mod; file-format details were derived by reading the mod's public source and observing on-disk bytes.
- **Written by AI (Doubao).**
