# Releasing NEXUS

Production packaging for NEXUS: installers, portable builds, signed auto-updates.

## Version bump

Release version lives in three places — keep them in sync:

- `package.json` → `"version"`
- `src-tauri/Cargo.toml` → `[package] version`
- `src-tauri/tauri.conf.json` → `version`

## Build

```bash
npm install
npm run tauri:build        # production build + bundles for the host OS
```

Artifacts land in `src-tauri/target/release/bundle/`:

| OS | Installer | Portable |
|----|-----------|----------|
| Linux | `.deb`, `.rpm` | `.AppImage` |
| macOS | `.app` / `.dmg` | the `.app` bundle |
| Windows | NSIS installer (`.exe`, per-user, no admin) | zip the built exe + WebView2 note |

The Windows NSIS installer is configured with `installMode: currentUser`
(installs to `%LOCALAPPDATA%`, no UAC prompt).

## Auto-updater

NEXUS ships with Tauri's updater plugin wired end-to-end:

- Rust: `tauri-plugin-updater` + `tauri-plugin-process` registered in `src-tauri/src/lib.rs`
- Permissions: `updater:default`, `process:allow-restart` in `capabilities/default.json`
- Frontend: command palette → **"Check for updates"** (`src/lib/updater.ts`)
- Signed artifacts: `createUpdaterArtifacts: true` produces `*.sig` files next to every bundle
  plus a `latest.json` manifest for each target

### Signing keys

The minisign keypair signs update artifacts so clients can verify them.

- Private key: `src-tauri/keys/nexus-updater.key` — **gitignored, keep it secret and backed up**
- Public key: committed in `tauri.conf.json` under `plugins.updater.pubkey`

To sign a release build, expose the private key via environment:

```bash
export TAURI_SIGNING_PRIVATE_KEY_PATH=src-tauri/keys/nexus-updater.key
# or: export TAURI_SIGNING_PRIVATE_KEY="$(cat src-tauri/keys/nexus-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""   # empty unless the key has one
```

If the private key is lost, updates can no longer be signed; you must generate a new
keypair and ship an installer that carries the new pubkey.

### Endpoint & publishing

`plugins.updater.endpoints` currently points at a placeholder
(`https://updates.nexus.local/...`). Replace it with your static file host.
Supported template variables: `{{target}}` (e.g. `linux`), `{{arch}}`,
`{{current_version}}`.

For each release, upload the bundles **and** their `.sig` files, then publish a
manifest like:

```json
{
  "version": "0.2.0",
  "notes": "Release notes here",
  "pub_date": "2026-08-23T12:00:00Z",
  "platforms": {
    "linux-x86_64": { "signature": "<contents of .sig>", "url": "https://.../NEXUS_0.2.0_amd64.AppImage" },
    "windows-x86_64": { "signature": "<contents of .sig>", "url": "https://.../NEXUS_0.2.0_x64-setup.exe" },
    "darwin-aarch64": { "signature": "<contents of .sig>", "url": "https://.../NEXUS_0.2.0_aarch64.app.tar.gz" }
  }
}
```

Point the endpoint at that file (e.g. `https://your.host/{{target}}-{{arch}}.json`).
If the endpoint is unreachable or unset, the in-app check reports a graceful error;
the rest of the app is unaffected.

## Code signing (OS-level)

Optional but recommended for distribution outside sideloading channels:

- **Windows:** an EV/OV certificate via `windows.certificateThumbprintFields` in
  `tauri.conf.json` or `signtool` post-signing.
- **macOS:** Developer ID Application cert + notarization
  (`APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_API_KEY` env vars — see Tauri docs).

Linux artifacts are not conventionally code-signed.

## Local-first principles

The updater performs one opt-in metadata check when the user invokes it — nothing
automatic, no telemetry, no account. Everything else stays fully offline.
