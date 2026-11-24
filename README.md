# Capcut Studio
Next.js 15 / React 19 / TypeScript / Tailwind CSS 4. Fabric.js photo editing; FFmpeg.wasm local video processing; dnd-kit timeline; Capacitor Android APK. No paid API key.

## Run
```sh
npm install
npm run dev
```

Photo editor: /photo-editor. Video editor: /video-editor. The FFmpeg wasm core is copied from the pinned open-source npm package into public/ffmpeg during prebuild/predev and then served as a same-origin static asset, including inside the Android APK. Video processing may be limited by memory on Android.

Workflow `.github/workflows/ci.yml` checks TS and builds static Next.js. Tagged `v*` push builds a debug APK and uploads it to GitHub Releases. No release tag or merge should be created before the Founder's `VERIFIED` comment.

Remotion, Remotion Player, Konva, and video.js are installed for expansion, not falsely described as the active export pipeline. Production uses FFmpeg.wasm instead. Android remote navigation allowlist is configured but no remote server URL is used.