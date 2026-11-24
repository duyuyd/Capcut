# Verification instructions
CI: GitHub Actions Web CI (npm install / TypeScript / Next.js static build).
E2E: GitHub Actions Browser E2E. It generates *real* image and MP4 media on the CI machine, uploads them to the editor, edits, downloads output, and records browser video/trace. Output under test-results is uploaded as a workflow artifact.
Android: GitHub Actions Build Android APK, manually dispatchable, or on v* tag. A v* tag additionally creates a GitHub Release after validating the APK exceeds 5 MiB. Without a tag, workflow_dispatch creates an APK artifact only.
Project has no backend / paid key. First FFmpeg.wasm core load requires internet because it is fetched from a public jsDelivr CDN. Offline-first use without network at first run is not yet provided.
Do not merge pull request until Founder comments VERIFIED.
