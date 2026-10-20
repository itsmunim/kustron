# How kustron compares with tilt.dev

Tilt (tilt.dev) is the best-known tool in the "make Kubernetes a nice dev
environment" space, so this page exists to answer one question honestly:
**when should you reach for Tilt, and when is kustron the better fit?**

## Sourcing rules (no bluff)

Two hard rules for this page:

1. **Every kustron claim below was verified against a live k3d cluster**
   (kustron v2.1.1, macOS, podman + OrbStack + Docker runtimes, October
   2026) — a kitchen-sink env with source/image/helm/component/instance/HA
   apps, rebuild cycles, prune, stop/destroy, and the error paths.
2. **Every Tilt claim comes from Tilt's official documentation** (tilt.dev,
   docs.tilt.dev; links inline) — the Tilt cells were *not* hand-tested.
   They are stated as documented behavior, not as verified fact.

## Principles at a glance

| Principle | kustron | Tilt |
| --- | --- | --- |
| Configuration model | One declarative `kustron-env.yaml` (docker-compose style), strict zod schema, `kustron env show-spec` documents every field — [verified] | A `Tiltfile`: a Starlark *program* (loops, functions, conditionals) — [docs](https://docs.tilt.dev/tiltfile_concepts.html) |
| Runtime model | One-shot reconcile commands (`env up` re-run = no-op when nothing changed); nothing runs between commands — [verified] | A long-running control loop (`tilt up` stays up, watches files, re-deploys continuously) — [docs](https://docs.tilt.dev/controlloop.html) |
| Cluster ownership | kustron creates/configures/destroys the k3d cluster, its registry, and metrics-server itself — [verified] | Tilt deploys *into* whatever cluster you already have; cluster creation is a separate tool (ctlptl) — [docs](https://docs.tilt.dev/faq.html) |
| UI | CLI only: tables, logs, port forwards | Terminal streaming + full web UI (resource graph, endpoints, per-resource buttons, snapshots) — [docs](https://docs.tilt.dev/tutorial/3-tilt-ui.html) |
| Install surface | `npm install -g kustron` (Node ≥ 18); Node CLI, no Go toolchain | Single Go binary — [docs](https://docs.tilt.dev/install.html) |

## Where kustron wins (all verified in the live-cluster tests)

| Capability | Why it's useful |
| --- | --- |
| Owns the full cluster lifecycle: create, start, stop, **destroy** (`env destroy` deletes everything and cleans the kubeconfig) | "docker-compose down" for Kubernetes — nothing lingers, ideal for sandboxes/demos and cheap cloud VMs. Tilt never removes your cluster |
| Compose-style lifecycle: `env up/stop/status/reload/destroy` + per-app `app start/stop/logs/exec/forward` — all resolve component apps, per-app namespaces, and `instance` suffixes | The inner dev loop without kubectl incantations |
| Deterministic, idempotent `env up`: content-hash image tags, skip when the deployed image hash matches, YAML-only changes reconcile without rebuild, removed apps are pruned | Re-running `up` costs seconds, not rebuilds — the reconcile is honest: we re-deploy only what changed |
| Cluster-scoped registries (`<clusterName>-registry`) with the host port discovered from the running container | Multiple projects can run their own k3d clusters in parallel without registry name/port collisions |
| Exposed apps pin a **cluster-free NodePort** inside the loadbalancer-mapped window, with free-port-only lb mappings at cluster create | `localhost:<nodePort>` is reliably reachable instead of the ~4% chance a random NodePort lands in the mapped range |
| Healthchecks match the protocol (`tcp`/`/path`/none, opt-in) and rollouts fail fast on `ImagePull/CrashLoopBackOff` with a 150 s warn path | Databases don't stall rollouts; broken deploys don't hang forever |
| First-class `secret:` block (real K8s Secrets) + `${ENV}` shell interpolation | Not configmap-with-a-rename |
| `components:` bundles (Kustronfile with inputs/outputs) wired via `${component.x}` | Reusable infra units — e.g. a shared "postgres+cache" bundle — without duplicating yaml |
| One-liner `instance:` (same app twice: `pg-primary`/`pg-secondary`) and per-app `namespace:` | Multi-region/tenant testing locally; namespace isolation |
| One-liner `ha: true` (HPA min 2/max 5, CPU 90 %, mem 80 %) with metrics-server auto-installed | Autoscaling parity without hand-writing HPA yaml |
| Strict schema with helpful failures (rejects unknown keys) + `env init`/`apps add/remove` scaffolding | The YAML file is the environment's documentation |
| `registry:` creds per app → imagePullSecret created and attached; registry login/prune commands | Pull-through for private images in local dev |

## Where Tilt wins today (per its docs; honest gaps in kustron)

| Tilt capability | Tilt docs | kustron status |
| --- | --- | --- |
| `live_update`: syncs changed files *into running containers* in seconds, with `run` steps and `fall_back_on` rebuild rules | [live_update reference](https://docs.tilt.dev/live_update_reference.html) | **Main gap.** `env watch` re-runs the reconcile: changed source = image **rebuild + push + rollout** (tens of seconds for small apps), not in-place sync. Planned: a Tilt-lite `liveUpdate` per app (kubectl cp/exec-based sync + optional container-run steps, fallback to rebuild) |
| Streaming terminal output + web UI: unified per-resource logs, endpoints, trigger-mode pausing, snapshots for sharing crash states | [Tilt UI](https://docs.tilt.dev/tutorial/3-tilt-ui.html) | CLI tables + `app logs -f` only. Planned: `env tail` (aggregated follow logs); the web UI is out of scope by design (no daemon runs between commands) |
| `tilt ci`: headless deterministic run of the dev env for CI pipelines | [tilt up / ci](https://docs.tilt.dev/tilt_up.html) | Not yet: `env up` warns-and-continues on 150 s rollouts (by design for humans). Planned: a `--ci` flag (no warnings-as-success, non-zero exit on first failure) |
| `local_resource`: long-running *host-side* processes as resources (tests, migrations) | [Tiltfile API](https://docs.tilt.dev/api.html) | `hooks.pre/post` run one-shot commands during deploy; no persistent host-process view |
| Parallel deploys across the dependency graph | [Control loop](https://docs.tilt.dev/controlloop.html) | `env up` deploys sequentially in topo order — unrelated apps still wait on each other (each rollout can add up to 150 s). This is real time cost on large envs |
| Any Kubernetes cluster (kind/minikube/docker-desktop/remote with `allow_k8s_contexts`) | [Tilt FAQ](https://docs.tilt.dev/faq.html) | k3d only (a deliberate scope cut — k3d is tiny and fast; adding kind/minikube is a replaceable driver away) |
| Config profiles via Tiltfile args | [Tiltfile concepts](https://docs.tilt.dev/tiltfile_concepts.html) | Single env file per directory today; profiles/overrides are on the roadmap |
| A Starlark program as config (loops, conditionals, starlark libraries) | [Tiltfile concepts](https://docs.tilt.dev/tiltfile_concepts.html) | Fixed schema — no logic. That's the point: less power, far less to learn or get wrong (see above) |

## The one-paragraph version

Tilt is an **engine**: a permanent control loop that watches your files and
streams everything into a UI, and it can sync files into running containers
seconds after you save. Kustron is a **lifecycle tool**: one YAML file that
brings a real (k3d) cluster up, reconciles it deterministically, and tears
it down completely — with no daemon, no UI, and no Starlark.

If your team lives in a hot-reload inner loop against large codebases and
wants a UI, use Tilt. If you want the compose workflow —
*declare the stack, `up` it, poke it with curl, `destroy` when done* — on a
real Kubernetes cluster with no Kubernetes knowledge required, kustron does
that with a single declarative file.

They're not mutually exclusive either: kustron already covers the
"environment exists and is healthy" part that Tilt outsources to ctlptl.

---

*Corrections welcome: every verified cell above refers to code in `master`
(v2.1.1) — if a behavior changes, update this page in the same PR.*
