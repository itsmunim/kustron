---
'kustron': patch
---

env watch now also watches `kustron-env.yaml`, so adding/removing apps (e.g. a new source or helm chart app) triggers a reconcile even when no local source file changes
