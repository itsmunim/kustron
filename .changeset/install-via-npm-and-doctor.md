---
'kustron': patch
---

Ship a CLI-ready npm package: add `bin` and `files` fields so `npm install -g kustron` and `npx kustron` work, and stop publishing sources, tests and docs to the registry.

`install.sh` now installs kustron from npm instead of cloning and building from source (no git clone, no build step, no dev dependencies); upgrade later with `npm update -g kustron`.

New `kustron doctor` command: checks container runtime, k3d, kubectl, railpack, helm and git, verifies the container runtime daemon is reachable, prints install links for anything missing, and exits non-zero when required dependencies are missing.

`kustron --version` now reports the actual installed package version instead of a hardcoded 2.0.0.
