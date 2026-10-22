# AGENTS.md — Operating Kustron as a Coding Agent

Kustron turns one declarative file (`kustron-env.yaml`) into a running local
environment: it creates its own k3d cluster + container registry, builds
images from source or public repos, deploys apps (source / image / Helm
chart), and waits for them to be ready. You can provision a full stack for
the user, run their tests against it, and tear it down—without ever touching
their kubectl context.

**Scope note:** this file is for agents *using* kustron in a user's project.
For agents hacking on the kustron codebase itself, read `SKILL.md`.

## Unbreakable rules

1. **Never prompts in unattended shells.** Every interactive flow has a
   flag/`--yes` equivalent: `env init --name … --port … --exposed`,
   `env destroy --yes`, `env init -f` to overwrite. If a command would
   prompt, it exits instead — pass the flag.
2. **Never touches your kubeconfig context.** All k3d/helm scoped calls use
   `--context=k3d-<clusterName>`. `env destroy` deletes only kustron's own
   context entry + cluster.
3. **`kustron-env.yaml` is the source of truth.** Change the file, then
   `kustron env reload` (or keep `env watch` running).
4. **Exit codes are contracts:** `env up` = 0 only when every rollout +
   healthcheck passed; `env status` = 0 only when the cluster is up and
   every app is healthy; `doctor` = 0 only when required deps + daemon OK;
   `env destroy --yes` = 0 = everything gone.

## Typical agent flow: provision a stack and test it

```sh
kustron doctor --json          # gate on .healthy (also implies deps OK)
kustron env init --name api --port 3000 --exposed --cluster <uniqueName>
                               # --cluster isolates you from default-named clusters (see gotchas)
kustron env up                 # exits 0 only when everything is ready
kustron env status --json      # gate on .healthy; read .apps[].nodePort / .url
curl http://localhost:<nodePort>/…   # run tests against the stack
kustron app logs api [-f]      # debug failures
kustron app exec api -- env    # poke inside a container
kustron env destroy --yes      # clean up: cluster, registry data, kubeconfig entry
```

## Machine-readable commands (`--json`, banner suppressed)

`kustron doctor --json` →

```json
{"version":"2.1.2","node":"v22.22.3","healthy":true,"daemonReachable":true,
 "checks":[{"name":"k3d","required":true,"present":true,"installHint":"…"}]}
```

`kustron env status --json` →

```json
{"cluster":{"name":"kvdemo","exists":true,"running":true},"namespace":"kvdemo",
 "healthy":true,
 "apps":[{"name":"webapi","deployment":"webapi","namespace":"kvdemo","type":"source",
   "deployed":true,"readyReplicas":1,"desiredReplicas":1,"state":"running",
   "image":"…","exposed":true,"nodePort":30000,"url":"http://127.0.0.1:30000",
   "healthy":true}]}
```

For Helm-chart apps, `.state` is the Helm release status
(`deployed`/`missing`/…) instead of a deployment table state — chart-owned
resources don't match kustron's naming, and only the release is reliable.

## The file

Full annotated schema: `kustron env show-spec` (run it — it is the schema
source of truth, kept in sync by tests). Minimal file:

```yaml
config:
  namespace: myenv            # default namespace; override per app with `namespace:`
apps:
  - name: api
    source: ./services/api    # Dockerfile here, or any git/public repo URL
    port: 3000
    exposed: true             # reachable at localhost:<nodePort> after up
    healthcheck: /health      # rollout waits for HTTP 200 (or `tcp`)
    dependsOn: [db]           # ordered rollout
    env:
      DB_HOST: db             # reaches the db app by its service name
  - name: db
    image: postgres:15
    port: 5432
```

Port notes: only NodePorts **30000–30100** are mapped to the host at cluster
create time (k3d assigns 30000–32767, so a NodePort above 30100 is assigned
but not reachable from localhost). Ports stay stable across reloads while
the cluster lives. Non-exposed apps are only reachable inside the mesh
(`app forward <name> <localPort> [remotePort]`).

## Gotchas that cost agents time

- **Default-named clusters adopt you.** Without `--cluster` (or a
  `clusterName:` in the yaml) a stack controls the default-named `kustron`
  cluster — if one already exists on the machine, `env up` deploys into it
  silently. Always pass `--cluster <uniqueName>` from an agent sandbox.
- **Legacy clusters don't remap NodePorts.** The 30000–30100 host mapping is
  only added at cluster creation: an old cluster (or a cluster recreated by
  other tooling) can report healthy pods whose exposed apps are still
  unreachable on localhost. Recreate the cluster (`env destroy` + `env up`)
  to fix reachability.

- Env vars live in ConfigMaps; changes trigger a rolling restart via an
  env-hash annotation, but a `kubectl exec` session must be re-opened.
- Git sources are cached in `~/.kustron/git-cache/` — private repos need the
  user's SSH key loaded, `registry login <server>` covers private images.
- `env stop` pauses the stack (apps scaled down, cluster kept); `env down`
  is deprecated; `env destroy` deletes everything including data.
- If ports/actions seem stale: re-run `kustron env status --json` — it
  queries the live cluster, not state files.
