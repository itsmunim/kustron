const http = require('http');

const VERSION = 'v1';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('ok');
    return;
  }
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(`hello from kustron demo ${VERSION}\n`);
});

server.listen(3000, () => {
  console.log('webapi listening on :3000');
});
