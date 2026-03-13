# Portable Node.js Installation Guide

How MaxAuto downloads and uses a standalone Node.js binary without requiring a global install.

## Download URLs

All portable binaries at `https://nodejs.org/dist/v{VERSION}/`.

| Target | URL |
| --- | --- |
| Windows x64 | `https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-x64.zip` |
| Windows ARM64 | `https://nodejs.org/dist/v22.12.0/node-v22.12.0-win-arm64.zip` |
| macOS x64 | `https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-x64.tar.gz` |
| macOS ARM64 | `https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-arm64.tar.gz` |

Use `.zip` for Windows, `.tar.gz` for macOS. Self-contained, no PATH modification.

## Directory Structure After Extraction

### Windows (.zip)

```text
node-v22.12.0-win-x64/
  node.exe
  npm.cmd
  npx.cmd
  node_modules/
    npm/
      bin/
        npm-cli.js          # real npm entry point
        npx-cli.js
```

### macOS (.tar.gz)

```text
node-v22.12.0-darwin-arm64/
  bin/
    node                    # the binary
    npm -> ../lib/node_modules/npm/bin/npm-cli.js
    npx -> ../lib/node_modules/npm/bin/npx-cli.js
  lib/
    node_modules/
      npm/
        bin/
          npm-cli.js        # real npm entry point
          npx-cli.js
```

### npm-cli.js paths summary

- **Windows:** `{node_dir}/node_modules/npm/bin/npm-cli.js`
- **macOS:** `{node_dir}/lib/node_modules/npm/bin/npm-cli.js`

## Running npm Without Global Install

Invoke node directly with npm-cli.js to avoid shell wrappers and PATH deps:

**Windows:**

```text
{node_dir}\node.exe {node_dir}\node_modules\npm\bin\npm-cli.js install --prefix {target} openclaw
```

**macOS:**

```text
{node_dir}/bin/node {node_dir}/lib/node_modules/npm/bin/npm-cli.js install --prefix {target} openclaw
```

## npm install --prefix Behavior

### Local install (without -g) -- RECOMMENDED

```bash
node npm-cli.js install --prefix ./openclaw openclaw
```

Creates:

```text
openclaw/
  package.json
  package-lock.json
  node_modules/
    .bin/
      openclaw          # Unix shell script
      openclaw.cmd      # Windows batch wrapper
    openclaw/
      package.json
      bin/openclaw.js   # actual JS entry point
      ...
```

Binary location (same structure on both platforms):
- macOS: `openclaw/node_modules/.bin/openclaw`
- Windows: `openclaw/node_modules/.bin/openclaw.cmd`

### Global-style install (with -g --prefix) -- alternative

```bash
node npm-cli.js install -g --prefix ./openclaw openclaw
```

macOS creates:

```text
openclaw/
  bin/
    openclaw -> ../lib/node_modules/openclaw/bin/openclaw.js
  lib/
    node_modules/
      openclaw/...
```

Windows creates:

```text
openclaw/
  openclaw.cmd          # at top level, NOT under bin/
  node_modules/
    openclaw/...
```

Note the asymmetry: macOS uses `bin/` + `lib/node_modules/`, Windows puts wrappers at prefix root + `node_modules/`.

### Recommendation for MaxAuto

Use local install (no `-g`), then run the installed package directly:

```text
{node_dir}/node {prefix}/node_modules/openclaw/bin/openclaw.js [args]
```

This sidesteps all platform-specific wrapper differences. We control exactly which `node` and which JS file runs.

## Verifying Downloads

Checksum file: `https://nodejs.org/dist/v22.12.0/SHASUMS256.txt`

macOS/Linux:

```bash
curl -O https://nodejs.org/dist/v22.12.0/SHASUMS256.txt
grep "node-v22.12.0-darwin-arm64.tar.gz" SHASUMS256.txt | shasum -a 256 -c -
```

Windows (PowerShell):

```powershell
$expected = (Get-Content SHASUMS256.txt | Select-String "win-x64.zip").ToString().Split(" ")[0]
$actual = (Get-FileHash node-v22.12.0-win-x64.zip -Algorithm SHA256).Hash.ToLower()
if ($expected -eq $actual) { "OK" } else { "MISMATCH" }
```

## End-to-End Flow for MaxAuto

1. **Download** platform-appropriate archive from nodejs.org/dist/
2. **Verify** SHA-256 against SHASUMS256.txt
3. **Extract** to `~/.openclaw-maxauto/node/`
4. **Install OpenClaw:**

   ```text
   {node_dir}/node {node_dir}/{lib/}node_modules/npm/bin/npm-cli.js install --prefix ~/.openclaw-maxauto/openclaw openclaw
   ```

5. **Run OpenClaw:**

   ```text
   {node_dir}/node ~/.openclaw-maxauto/openclaw/node_modules/openclaw/bin/openclaw.js gateway run --bind loopback --port 18789
   ```

No system-level Node.js install needed. Entire runtime is self-contained within `~/.openclaw-maxauto/`.
