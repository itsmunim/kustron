---
'kustron': patch
---

Silent cleanup: `env destroy` no longer prints a red `Command failed` line for the kubecontext delete when the context entry isn't in the default kubeconfig file. Only consequential command failures are reported now; best-effort probes stay silent.
