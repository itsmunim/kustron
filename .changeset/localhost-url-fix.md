---
'kustron': patch
---

`env status --json` now reports `apps[].url` as a deterministic reachable address (`http://localhost:<nodePort>` when no k3d node IP is resolvable) instead of the human-mode prose fallback (`NodePort 30000`) that previously leaked into machine output
