---
'kustron': patch
---

`kustron app logs` now streams pod logs as they arrive instead of swallowing
them — previously the command printed nothing without `--verbose` (captured,
never shown) and `app logs -f` appeared to hang forever. Implemented via a new
`stream` option on the shared exec helper that pipes child stdout/stderr to the
console while still capturing final output for command paths that need it.
