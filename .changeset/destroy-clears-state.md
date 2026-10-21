---
'kustron': patch
---

`kustron env destroy` now clears the `.kustron/state.json` that tracks
deployed apps, and best-effort helm uninstalls (pruning apps removed from
the env file) no longer print a red "Command failed" banner when the
release is not loaded — stale state after a destroy made the next
`env up` prune against an empty cluster.
