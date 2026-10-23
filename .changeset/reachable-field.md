---
'kustron': patch
---

`env status --json` / `env up --json` app rows gain `reachable` — a host TCP-dial of the exposed NodePort through the cluster's port mapping, kept separate from pod-based `healthy` so a legacy cluster (healthy pods, but the 30000–30100 host mapping was never created) is visible as `reachable: false` instead of silently unreachable
