#!/bin/sh
# demo part 3 — add the RabbitMQ helm chart + the publish route
cd "$(dirname "$0")"
python3 - <<'PY'
from pathlib import Path

# 1) server.js: POST /orders — pushes the order through the queue
sp = Path('webapi/server.js')
code = sp.read_text()
if "app.post('/orders'" in code:
    print('POST /orders already present')
else:
    route = """\
app.post('/orders', async (req, res) => {
  const order = {id: Date.now(), product: req.body.product, qty: req.body.qty};
  const conn = await amqp.connect(process.env.RABBIT_URL);
  const ch = await conn.createChannel();
  ch.sendToQueue('orders', Buffer.from(JSON.stringify(order)));
  await ch.close();
  await conn.close();
  res.status(202).json({queued: order});
});

"""
    anchor = 'app.listen(3000'
    assert anchor in code, 'anchor missing'
    sp.write_text(code.replace(anchor, route + anchor))
    print('added: POST /orders → publishes to rabbitmq')

# 2) kustron-env.yaml: rabbitmq chart, webapi now depends on the bus
yp = Path('kustron-env.yaml')
yaml = yp.read_text()
if 'name: orders' in yaml:
    print('orders chart already present')
else:
    yaml = yaml.rstrip('\n') + """
  # the orders message bus — a local helm chart wrapping rabbitmq
  - name: orders
    helm:
      chart: ./charts/orders
      values:
        auth.username: guest
        auth.password: guest
"""
    yaml = yaml.replace(
        '    dependsOn: [kivo]',
        '    dependsOn: [kivo, orders]',
    )
    yaml = yaml.replace(
        '      KIVO_URL: redis://kivo:6379',
        '      KIVO_URL: redis://kivo:6379\n'
        '      RABBIT_URL: amqp://guest:guest@orders:5672/',
    )
    yp.write_text(yaml)
    print('added: rabbitmq chart + RABBIT_URL injected into webapi')
PY
printf '%s\n' '--- yaml tail ---'
tail -14 kustron-env.yaml
