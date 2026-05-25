const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3015;
const CF_HOST = 'api.cloudflare.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

let cachedHtml = null;
function loadHtml() {
  if (!cachedHtml) {
    const tryPaths = [
      path.join(__dirname, 'htdocs', 'index.html'),
      path.join(__dirname, 'public', 'index.html'),
      path.join(__dirname, 'index.html'),
    ];
    for (const p of tryPaths) {
      try { cachedHtml = fs.readFileSync(p); break; } catch(e) {}
    }
  }
  return cachedHtml;
}

http.createServer((req, res) => {

  // 1) CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    res.end();
    return;
  }

  // 2) Proxy: /api/* → api.cloudflare.com/client/v4/*
  if (req.url.startsWith('/api/') || req.url === '/api') {
    const cfPath = '/client/v4' + req.url.slice(4);
    const fwd = { 'Content-Type': 'application/json', 'Host': CF_HOST };
    if (req.headers['authorization']) fwd['Authorization'] = req.headers['authorization'];

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (body.length > 0) fwd['Content-Length'] = body.length;

      const proxy = https.request({
        hostname: CF_HOST, port: 443, path: cfPath,
        method: req.method, headers: fwd,
      }, (pRes) => {
        const h = { ...CORS };
        if (pRes.headers['content-type']) h['Content-Type'] = pRes.headers['content-type'];
        res.writeHead(pRes.statusCode, h);
        pRes.pipe(res);
      });

      proxy.on('error', (e) => {
        res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, errors: [{ message: e.message }] }));
      });

      if (body.length > 0) proxy.write(body);
      proxy.end();
    });
    return;
  }

  // 3) Serve dashboard
  const html = loadHtml();
  if (html) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('index.html nao encontrado');
  }

}).listen(PORT, '0.0.0.0', () => {
  console.log(`[CF DNS Manager] Porta ${PORT} - OK`);
});
