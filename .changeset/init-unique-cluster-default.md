---
'kustron': patch
---

`env init` now stamps a directory-derived `config.clusterName` (`<folder>-<6-hex of absolute path>`) into the generated yaml, so two kustron stacks can no longer silently adopt each other's default-named 'kustron' cluster; `--cluster <name>` overrides, and yamls written by hand that omit `clusterName` still resolve to the default for backward compatibility
