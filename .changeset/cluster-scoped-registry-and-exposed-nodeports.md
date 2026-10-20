---
'kustron': patch
---

Cluster-scoped registry names and pinned, conflict-free NodePorts

- Registry node name is now cluster-scoped (`kustron-registry` for the default `kustron` cluster, `<clusterName>-registry` otherwise), fixing `env up` failures when multiple clusters exist on one machine ("A registry node with that name already exists").
- Registry host port is discovered from the existing registry container instead of re-probed on every run, so `docker push` no longer targets a stale port.
- Port probing uses an exclusive bind (python3, node fallback) so macOS services that hold 5000 (AirPlay Receiver) are honored; the probe previously bound with SO_REUSEADDR and silently picked occupied ports.
- NodePort loadbalancer mappings skip host ports already taken by other clusters' loadbalancers, and exposed services pin a cluster-free NodePort (30000-30100 window), so `localhost:<nodePort>` is reachable — services used to get random NodePorts only 3.6% of the time.
- source/image + helm: `helm.imageValues` paths are now honored (the built image is injected into the chart through the configured values paths). Previously imageValues existed only in the schema and docs — nothing was ever injected.
- Components are now lifecycle-manageable: `env status`, `env stop`, `app stop/start/logs/exec/forward` operate on component apps and honor per-app namespaces and instance suffixes.
- TypeScript is fully strict-clean: fixed pre-existing type errors in `env init` (clack select generics), component validation (`ZodError.issues` for zod v4), and manifest envFrom typing.
- `helm.imageValues` injection no longer mutates the caller's values map (deep copy before merge).
