---
'kustron': patch
---

Machine-readable agent contracts: `env status --json` and `doctor --json` print pure JSON snapshots (startup banner suppressed in --json mode), and `env status` now exits 1 when the cluster is down or any app is unhealthy — Helm apps are gated on their Helm release status (`deployed`/`missing`) since chart-owned Deployments don't follow kustron's naming. Documented in the new AGENTS.md
