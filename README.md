# Capcut Studio
Next.js 15 / React 19 / TypeScript / Tailwind CSS 4. Fabric.js photo editing; FFmpeg.wasm local video processing; dnd-kit timeline; Capacitor Android APK. No paid API key.

## Run
```sh
npm install
npm run dev
```

Photo editor: /photo-editor. Video editor: /video-editor. The FFmpeg wasm core is copied from the pinned open-source npm package into public/ffmpeg during prebuild/predev and then served as a same-origin static asset, including inside the Android APK. Video processing may be limited by memory on Android.

Workflow `.github/workflows/ci.yml` checks TS and builds static Next.js. Tagged `v*` push builds a debug APK and uploads it to GitHub Releases. Production versions are released from `main` after validation. APKs are debug signed for direct installation, not Play Store distribution.

Remotion, Remotion Player, Konva, and video.js are installed for expansion, not falsely described as the active export pipeline. Production uses FFmpeg.wasm instead. Android remote navigation allowlist is configured but no remote server URL is used.
## Editing functionality (v0.2.0)
- Import, drag-reorder, per-clip in/out trim, playhead split, Undo/Redo for clip edits, speed 0.5–2x and audio gain 0–200%.
- Local autosave/restore in IndexedDB with original File blobs when browser storage permits. No cloud upload or paid API.
- FFmpeg.wasm MP4 export: aspect ratio, color filters, soundtrack replacement and overlay text.
- Important limitations: tracks are not yet arbitrary video/audio compositing; no keyframe animation, automatic captions, transitions or multi-device cloud sync. Large videos may exceed phone memory.
- E2E creates real videos during tests and checks output duration. Android workflow automatically publishes a debug APK Release when main builds successfully.
