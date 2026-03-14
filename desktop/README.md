# Desktop App

The repository now includes a working Electron shell in [desktop/package.json](/Users/tanjim/Downloads/Martin_luther_king/desktop/package.json).

## What It Does

- launches the FastAPI backend locally on `127.0.0.1:8123`
- loads the built frontend through the backend at `/desktop/`
- persists a desktop workspace path under the user's app data
- lets the user change or open the workspace folder from the desktop menu
- opens local release notes from the app menu
- restores the last project after relaunch and keeps a recent-project list
- imports `.cpsbundle` files through OS file associations
- checks for updates in packaged builds and stages downloaded updates for relaunch
- supports launch-at-login and macOS move-to-Applications installation prompts
- primes a new workspace from a packaged bootstrap database and model cache
- exposes first-run onboarding, local AI runtime status, backup/import, teacher review, and revision history in the UI
- defers heavier model warmup on desktop boot so the shell becomes responsive faster
- supports packaging through `electron-builder`

## Desktop Commands

Install dependencies:

```bash
cd desktop
npm install
```

Run the desktop shell from source:

```bash
cd desktop
npm run dev
```

Build the backend executable used by packaged releases:

```bash
cd desktop
npm run build:backend
```

Package the desktop app:

```bash
cd desktop
npm run dist
```

Build platform-specific packages:

```bash
cd desktop
npm run dist:mac
npm run dist:win
npm run dist:linux
```

## Packaging Notes

- the desktop shell uses Electron because Rust is not required
- packaged builds bundle:
  - the backend executable
  - the built frontend
  - a bootstrap database and model cache for faster first launch
  - templates
  - community packs
  - `Legacy_of_Justice.html`
- packaged releases include desktop release notes and icon assets
- packaged releases publish update metadata for Electron auto-update flows
- macOS builds ship as `.dmg` plus `.zip`
- Windows builds ship as NSIS installers plus portable executables
- Linux builds ship as `AppImage` plus `.deb`
- optional local `tesseract` OCR still works if installed on the machine
- optional local-LLM mode still works if the user has a compatible local endpoint such as Ollama

## Signing And Notarization

The repo includes:

- [signing.env.example](/Users/tanjim/Downloads/Martin_luther_king/desktop/signing.env.example)
- [../.github/workflows/desktop-release.yml](/Users/tanjim/Downloads/Martin_luther_king/.github/workflows/desktop-release.yml)

Provide these when you are ready for a real public macOS release:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

The desktop release workflow now builds:

- macOS artifacts on `macos-latest`
- Windows installers on `windows-latest`
- Linux packages on `ubuntu-latest`
