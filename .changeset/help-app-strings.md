---
'kustron': patch
---

`kustron app --help` printed raw i18n fallback keys (cli.appDescription, cli.appStopDescription, …) because the strings were missing from the translation table; all app command descriptions are now real text, and `t()` fails the test suite loudly on any missing key so this can't recur silently
