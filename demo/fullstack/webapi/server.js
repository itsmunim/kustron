import express from 'express';
import {createClient} from 'redis';
import amqp from 'amqplib';

// kivo — the Redis-compatible KV store, over the wire via RESP2
const r = createClient({url: process.env.KIVO_URL || 'redis://localhost:6379'});
r.on('error', (e) => console.log('[kivo] retrying…', e.message));
r.on('ready', () => console.log('[kivo] connected'));
await r.connect();

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({status: 'ok'}));

// CRUD, persisted in kivo
app.get('/items', async (_req, res) => {
  const ids = await r.sMembers('items');
  const items = await Promise.all(
    ids.map(async (id) => ({id, ...(await r.hGetAll(`item:${id}`))})),
  );
  res.json(items);
});

app.get('/items/:id', async (req, res) => {
  const item = await r.hGetAll(`item:${req.params.id}`);
  if (!Object.keys(item).length)
    return res.status(404).json({error: 'not found'});
  res.json({id: req.params.id, ...item});
});

app.post('/items', async (req, res) => {
  const {id, ...rest} = req.body;
  if (!id) return res.status(400).json({error: 'id is required'});
  await r.hSet(`item:${id}`, rest);
  await r.sAdd('items', id);
  res.status(201).json({id, ...rest});
});

app.delete('/items/:id', async (req, res) => {
  await r.del(`item:${req.params.id}`);
  await r.sRem('items', req.params.id);
  res.json({deleted: req.params.id});
});

// queue consumer — dormant until kustron injects RABBIT_URL
if (process.env.RABBIT_URL) {
  const conn = await amqp.connect(process.env.RABBIT_URL);
  const ch = await conn.createChannel();
  await ch.assertQueue('orders');
  await ch.consume('orders', async (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`[orders] received ${order.id} → saving to kivo`);
    await r.rPush('orders', JSON.stringify(order));
    ch.ack(msg);
  });
  console.log('[orders] consumer up, waiting on rabbitmq');
}

app.listen(3000, () => console.log('listening on :3000'));
