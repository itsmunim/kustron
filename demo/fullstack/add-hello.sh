#!/bin/sh
# demo part 4 — deploy a public GitHub repo as-is (Go Gin hello-world)
cd "$(dirname "$0")"
python3 - <<'PY'
from pathlib import Path

p = Path('kustron-env.yaml')
yaml = p.read_text()
if 'name: hello' in yaml:
    print('hello app already present')
else:
    yaml = yaml.rstrip('\n') + """
  # public repo, cloned + built + deployed by kustron as-is
  - name: hello
    source: https://github.com/bakeruk/kubernetes-hello-world-api.git
    port: 3000
    exposed: true
"""
    p.write_text(yaml)
    print('added: hello (cloned from GitHub, built as-is)')
PY
printf '%s\n' '--- yaml tail ---'
tail -8 kustron-env.yaml
