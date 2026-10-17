---
"kustron": minor
---

Kustron 2.0: one file (`kustron-env.yaml`) defines a full local Kubernetes stack, then `kustron env up` builds, deploys, and exposes it.

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
