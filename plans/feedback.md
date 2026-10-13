Concept and architecture
Positioning. The premise is sound, but the space is crowded. Tilt, Skaffold and DevSpace already do build → push to the k3d registry → deploy → watch → port-forward. Score's score-k8s already turns a workload spec into manifests (CNCF). Kustron's edge is that it needs no Kubernetes knowledge and owns the cluster. That edge is a UX choice, not an engine feature, and the abstraction leaks early: patch, helm.selector, wait.type: established and the dotted imageValues paths all require knowing Kubernetes.

Keep
The schema primitives:
exactly one of source, image or helm;
healthcheck as /path, tcp or nothing, with probes opt-in (the right default for databases);
command, args and resources as real fields, and patch as a catch-all.
Content-hash tags, plus skipping the build when the deployed image already matches.
Splitting build from deploy, so a built image can feed a Helm chart through imageValues.
Failing fast on ImagePullBackOff / CrashLoopBackOff, looking only at the current ReplicaSet's pods.
Zod validation, cycle detection in the dependency sort, and picking the container runtime by which daemon actually responds.

Design flaws
Flaw	Consequence	Conventional answer
One global cluster kustron for every project; down deletes the cluster and reload = down + up	Bringing down one project destroys every other project and its data. apps add and apps remove tell you to run reload	One cluster per project, or one namespace per project in a shared cluster, with down scoped to that project
Kustron keeps no record of what it deployed; it runs kubectl apply in a loop	No pruning, no drift detection, no rollback. Removed apps keep running	One Helm release per environment, or server-side apply with an ApplySet / --prune -l managed-by=kustron
Exposure prints the node container's IP plus a NodePort	Unreachable on Docker Desktop or podman on macOS (Docker docs) and from a VM's public IP (k3d docs). The plan promised localhost:<port> and prescribed @loadbalancer port mapping; the code didn't follow it	k3d -p <port>@loadbalancer at cluster creation, or the Traefik ingress k3s already ships with *.localhost hosts
Uses whatever kube context is current, and env up switches it	Kustron hijacks your global kubectl context; env status can query a work cluster	--context k3d-kustron on every call, or a dedicated KUBECONFIG
Shells out to kubectl, helm and k3d and parses their JSON / jsonpath output	Brittle across CLI versions, and every exec quirk (verbose mode, silent, password logging) becomes a correctness bug	A Kubernetes client library or the Helm SDK, or at least one typed exec wrapper with tests
Hand-rolls what the tools already do	Rollout polling, ReplicaSet pruning, Helm repo management, a metrics-server install (k3s already ships it, k3s docs), and dependency waits on top of deploys that already run one at a time. That's more code, more bugs, and duplicate waits	kubectl rollout status plus a fast-fail check, revisionHistoryLimit, helm --repo --atomic, and deleting the metrics-server code
Strictly sequential deploy	Apps with no dependencies still wait on each other, so up takes as long as all rollouts added together (each can take up to 150s)	Deploy each level of the dependency graph in parallel
"Deterministic" is overclaimed	Git sources track HEAD; every Helm upgrade --install creates a new revision; the hash ignores .dockerignore; after a timeout with pods running, the rollout wait warns and carries on	Pin git refs, compare inputs before running helm upgrade, honour .dockerignore, and make timeouts fail
Secrets are plaintext	Env vars go into ConfigMaps, and registry passwords live in a YAML file the README tells you to commit	Secrets, ${ENV} references for credentials, and env.secret:
No inner development loop	No logs, exec, port-forward or watch commands, so the "no kubectl required" claim ends at the first bug	kustron logs, exec and forward, or hand the inner loop to Tilt or Skaffold
Features were bolted on rather than designed to work together	Components, instance, namespace, dependsOn and registry each ignore the others (bugs 11, 13, 17)	One step that turns the YAML into a fully resolved list of apps (names, namespaces, endpoints) that every command uses
Heavy defaults	2 agent nodes, plus 500m CPU / 512Mi limits on every container	A single node, requests only, no default limits
Codebase review
Critical
Breaks the main path or destroys data
down and reload delete the shared cluster (src/commands/env/down.ts:21).
On stock macOS, the AirPlay Receiver already holds port 5000, which the registry needs. Observed here: lsof shows ControlCe … TCP *:5000 (LISTEN).
--verbose breaks env up. With verbose on, captured stdout is "" (src/utils/exec.ts:47), so clusterExists reports false, env up tries to create the existing cluster again, and the rollout wait never completes. A probe through the real exec returned "" and Unexpected end of JSON input.
Exposed URLs can't be reached on Docker Desktop or podman on macOS, or from a VM.
Helm charts from a repo fail to install. Confirmed: non-absolute URLs should be in form of repo_name/path_to_chart.
Building without a Dockerfile needs BuildKit and BUILDKIT_HOST (Railpack docs), and nothing sets them up.
With podman, pushing to localhost:5000 doesn't pass --tls-verify=false, and podman verifies TLS by default.
Editing env: changes the ConfigMap, but the pods are never restarted, so the new values don't take effect (src/core/manifest.ts:87).
Removing an app from the YAML leaves it running.
High
Error output prints the full command line, including passwords from registry login -p and --docker-password (src/utils/exec.ts:69).
Components:
dependsOn isn't prefixed, so topoSortApps throws.
A git component's clone is deleted before its apps are built (src/core/components.ts:115).
A relative source: resolves against your working directory, not the component's directory.
Component apps skip validation and are missing from allApps and env status.
Pre-hooks run before the dependency waits, and hook failures are ignored (src/core/deployer.ts:305-330).
Dependency waits:
Waits on a Helm app time out after 180s.
established is a no-op (src/core/wait-deps.ts:31).
The wait uses the dependent app's namespace.
${x.endpoint} has no namespace (src/core/deps.ts:83).
Every kubectl call runs against whatever the current context is.
Registry:
It is bound to 0.0.0.0 with no auth, while the fallback binds to 127.0.0.1.
ensureRegistry returns early without connecting the registry (src/core/cluster.ts:142).
Unverified: the fallback-created registry may get a k3d- prefix, so lookups may not match it.
Helm values are merged one level deep, so imageValues drops sibling keys such as image.pullPolicy (src/core/helm.ts:115).
instance is ignored by the build-skip check, the Helm release name (two instances overwrite each other) and env status.
With ha: true, the Deployment still sets replicas, so every apply resets the HPA (src/core/manifest.ts:122, k8s docs).
Medium
Image references are parsed by splitting on the last :. nginx becomes repository ngin, and digests and registry ports also break (src/core/helm.ts:34).
The source hash always skips dist/, so an image that copies dist/ never rebuilds.
Git sources:
They are fully re-cloned every run.
The clone goes to a fixed temp directory, so a crashed run blocks the next one.
isGitUrl is implemented twice with different rules.
From the code: apps add splits --env on every = and keeps only the first two parts, so A=x=y is saved as A: x (src/commands/apps/add.ts:49). apps add and apps remove rewrite the file with a plain YAML load and dump, so your comments are lost.
The schema is too lenient:
port: "30x" becomes 30, and a non-numeric port becomes 80.
Unknown keys are accepted.
Invalid Kubernetes names are accepted.
An exposed Helm app without a selector is accepted.
The silent option is never read, so expected failures still print red errors.
Maintainability
The lockfile is out of sync with package.json, so npm ci fails and the installer falls back to npm install.
{reject: false} as Record<string, unknown> is repeated about 15 times instead of fixing exec's signature once.
Dead code: listr2, appendApp, getExposedPorts, unused DeployContext fields, and url = null threaded through every deploy function. 'kustron' is hardcoded in five files.
The t() translation layer serves a single locale.
Without --verbose there's no build progress at all.
The installer pipes the k3d and Helm install scripts from their main branches, and builds Kustron from master.
AI-assisted development readiness
The project was planned for agents: plans/implementation-plan-v2.md:554 has a "Technical Notes for Agents" section and a four-agent task breakdown. Nothing in the repo checks what agents produce. Six feat commits on Sep 30 to Oct 1 added about 1,100 lines and no tests, and the interaction bugs above cluster in exactly those commits.

Blocks agents

The build doesn't catch type errors, so agents get no feedback. tsup (esbuild) builds with type errors: I injected const broken: number = 'x', and the build printed Build success while tsc failed with TS2322. There is no typecheck script, npm test exits 1, there is no lint, and CI only deploys docs/.
Nothing can be checked without a real cluster. There is no dry-run or render mode, no example env files or fixtures, and no e2e harness.
npm ci fails on the out-of-sync lockfile.
.claude/ is gitignored, so shared agent settings, hooks and skills can't be committed.
Misleads agents

The plan presented to agents as the spec contradicts the code. It says to use @loadbalancer port mapping, registry host k3d-kustron-registry, timestamp tags, a LoadBalancer Service for Helm apps, and appendApp. The code does none of these.
20 code comments cite a roadmap that no longer exists. Comments say "idea 1–8" and "P1", but nothing in the repo matches, and commit fc6807b says the roadmap was purged.
coding-guidelines.md addresses agents, but the code ignores it. There are 14 type declarations outside src/types/, 12 user-facing strings bypass t(), Vitest is mandated but not installed, and the format script targets a test/ directory that doesn't exist. Nothing auto-loads the file: there's no CLAUDE.md or AGENTS.md.
The README states false claims as fact: idempotence, VM exposure and env pickup.
Works for agents

Files are all under 400 lines, with modules split by concern.
strict TypeScript, a single Zod schema, conventional commits, and a Prettier config.
Pure functions that can be tested today: manifest builders, topoSortApps, interpolate/buildVars, deepMerge, injectImageValues, the env-file parser.