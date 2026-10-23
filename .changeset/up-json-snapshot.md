---
'kustron': patch
---

`env up --json` prints the final machine snapshot (same contract as `env status --json`) once up completes, with stdout carrying nothing but the JSON; dependencies still gate the run and all human progress is suppressed in this mode
