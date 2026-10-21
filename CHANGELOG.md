# kustron

## 2.1.3

### Patch Changes

- b1639df: `kustron app logs` now streams pod logs as they arrive instead of swallowing
  them — previously the command printed nothing without `--verbose` (captured,
  never shown) and `app logs -f` appeared to hang forever. Implemented via a new
  `stream` option on the shared exec helper that pipes child stdout/stderr to the
  console while still capturing final output for command paths that need it.
- f017652: `kustron env destroy` now clears the `.kustron/state.json` that tracks
  deployed apps, and best-effort helm uninstalls (pruning apps removed from
  the env file) no longer print a red "Command failed" banner when the
  release is not loaded — stale state after a destroy made the next
  `env up` prune against an empty cluster.
- 563c9fa: `kustron app --help` printed raw i18n fallback keys (cli.appDescription, cli.appStopDescription, …) because the strings were missing from the translation table; all app command descriptions are now real text, and `t()` fails the test suite loudly on any missing key so this can't recur silently
- 2e5b76a: Machine-readable agent contracts: `env status --json` and `doctor --json` print pure JSON snapshots (startup banner suppressed in --json mode), and `env status` now exits 1 when the cluster is down or any app is unhealthy — Helm apps are gated on their Helm release status (`deployed`/`missing`) since chart-owned Deployments don't follow kustron's naming. Documented in the new AGENTS.md
- 2e5b76a: `env init` is now fully non-interactive when flags are given or the shell is a non-TTY (agents/CI): `--name`, `--port`, `--source`, `--image`, `--exposed`, `--force`; with no flags it defaults to the current folder name on `./` instead of hanging on prompts, and refuses to overwrite an existing file without `--force`. Also fixes the generated YAML mangling image references containing a colon (e.g. `redis:7` became the invalid `image: redis: 7`)
- cba36df: Silent cleanup: `env destroy` no longer prints a red `Command failed` line for the kubecontext delete when the context entry isn't in the default kubeconfig file. Only consequential command failures are reported now; best-effort probes stay silent.
- 11eb778: env watch now also watches `kustron-env.yaml`, so adding/removing apps (e.g. a new source or helm chart app) triggers a reconcile even when no local source file changes

## 2.1.2

### Patch Changes

- 32ca709: Cluster-scoped registry names and pinned, conflict-free NodePorts

  - Registry node name is now cluster-scoped (`kustron-registry` for the default `kustron` cluster, `<clusterName>-registry` otherwise), fixing `env up` failures when multiple clusters exist on one machine ("A registry node with that name already exists").
  - Registry host port is discovered from the existing registry container instead of re-probed on every run, so `docker push` no longer targets a stale port.
  - Port probing uses an exclusive bind (python3, node fallback) so macOS services that hold 5000 (AirPlay Receiver) are honored; the probe previously bound with SO_REUSEADDR and silently picked occupied ports.
  - NodePort loadbalancer mappings skip host ports already taken by other clusters' loadbalancers, and exposed services pin a cluster-free NodePort (30000-30100 window), so `localhost:<nodePort>` is reachable — services used to get random NodePorts only 3.6% of the time.
  - source/image + helm: `helm.imageValues` paths are now honored (the built image is injected into the chart through the configured values paths). Previously imageValues existed only in the schema and docs — nothing was ever injected.
  - Components are now lifecycle-manageable: `env status`, `env stop`, `app stop/start/logs/exec/forward` operate on component apps and honor per-app namespaces and instance suffixes.
  - TypeScript is fully strict-clean: fixed pre-existing type errors in `env init` (clack select generics), component validation (`ZodError.issues` for zod v4), and manifest envFrom typing.
  - `helm.imageValues` injection no longer mutates the caller's values map (deep copy before merge).

## 2.1.1

### Patch Changes

- 5f854d5: Ship a CLI-ready npm package: add `bin` and `files` fields so `npm install -g kustron` and `npx kustron` work, and stop publishing sources, tests and docs to the registry.

  `install.sh` now installs kustron from npm instead of cloning and building from source (no git clone, no build step, no dev dependencies); upgrade later with `npm update -g kustron`.

  New `kustron doctor` command: checks container runtime, k3d, kubectl, railpack, helm and git, verifies the container runtime daemon is reachable, prints install links for anything missing, and exits non-zero when required dependencies are missing.

  `kustron --version` now reports the actual installed package version instead of a hardcoded 2.0.0.

## 2.1.0

### Minor Changes

- 0347f4b: Kustron 2.0: one file (`kustron-env.yaml`) defines a full local Kubernetes stack, then `kustron env up` builds, deploys, and exposes it.

  - Three app types: build from source (local folder or git URL), run an existing image, or deploy a Helm chart.
  - Deterministic, idempotent `env up` with content-hash image tags and automatic pruning of removed apps.
  - `kustron env watch` for hot-reload on source changes.
  - App lifecycle and debugging: stop, start, logs, `exec`, and port forwarding without tearing down the cluster.
  - Secrets as real Kubernetes Secrets with `${ENV}` interpolation from the shell.
  - Protocol-aware healthchecks (`/<path>` HTTP, `tcp`, or none).
  - Deploy ordering with `dependsOn`, per-dependency readiness (`rollout` / `established` / custom `command`), and `hooks.pre` / `hooks.post`.
  - Helm support: nested `values`, extra `valuesFiles`, local and OCI charts, and `helm.imageValues`.
  - Private registry support with per-app credentials, imagePullSecrets, `registry login`, and `registry prune`.
  - First-class `command`, `args`, `resources`, and a deep-merge `patch` escape hatch.
  - CLI scaffolding: `env init`, `apps add` / `apps remove`, and `env show-spec`.
  - Reusable `components:` with inputs/outputs and `${component.x}` / `${app.endpoint}` interpolation.
