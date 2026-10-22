---
'kustron': patch
---

`env init --cluster <name>` writes `config.clusterName` so an environment provisions its own k3d cluster instead of silently adopting the default-named 'kustron' cluster if one already exists on the machine — verified end to end with a fresh cluster (init → up → status --json → curl 200 → destroy --yes)
