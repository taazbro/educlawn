# Civic Project Studio 0.3.0

## Added

- packaged auto-update scaffolding through `electron-updater`
- recent-project tracking with desktop restore on relaunch
- `.cpsbundle` file association support for imported project bundles
- desktop crash recovery for renderer and backend failures
- launch-at-login controls
- macOS move-to-Applications installation prompt
- cross-platform packaging targets for macOS, Windows, and Linux

## Improved

- startup now uses a dedicated splash experience instead of loading inside the main shell
- the desktop menu now includes recent projects, update actions, and install/runtime controls
- packaged releases now include artifact/update metadata for consumer-style distribution

## Notes

- `Legacy_of_Justice.html` remains bundled and preserved
- macOS signing and notarization still depend on external Apple credentials
- Windows and Linux packaging is configured for CI, even when built from a macOS dev machine locally
