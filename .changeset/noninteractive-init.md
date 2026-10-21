---
'kustron': patch
---

`env init` is now fully non-interactive when flags are given or the shell is a non-TTY (agents/CI): `--name`, `--port`, `--source`, `--image`, `--exposed`, `--force`; with no flags it defaults to the current folder name on `./` instead of hanging on prompts, and refuses to overwrite an existing file without `--force`. Also fixes the generated YAML mangling image references containing a colon (e.g. `redis:7` became the invalid `image: redis: 7`)
