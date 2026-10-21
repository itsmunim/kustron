#!/bin/sh
# demo part 2 — add the /orders endpoint, let `kustron env watch` pick it up
cd "$(dirname "$0")"
python3 - <<'PY'
from pathlib import Path

p = Path('webapi/server.js')
code = p.read_text()
if "app.get('/orders'" in code:
    print('/orders already present')
    raise SystemExit(0)

route = """\
// ORDERS — placeholder list served straight from kivo
app.get('/orders', async (_req, res) => {
  const rows = await r.lRange('orders', 0, -1);
  res.json(rows.map((row) => JSON.parse(row)));
});

"""
anchor = 'app.listen(3000'
assert anchor in code, 'anchor missing'
p.write_text(code.replace(anchor, route + anchor))
print('added: GET /orders → reads the "orders" list from kivo')
PY
printf '%s\n' '--- proof ---'
grep -n "app.get('/orders'" webapi/server.js
