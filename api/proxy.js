// Proxy all API requests to Cloudflare Worker
const WORKER_URL = 'https://molttalk.molttalk.workers.dev';

module.exports = async (req, res) => {
  const path = req.url;
  const target = WORKER_URL + path;

  const headers = {};
  if (req.headers.authorization) headers['Authorization'] = req.headers.authorization;
  if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];

  const opts = { method: req.method, headers };

  if (req.method === 'POST') {
    const body = await new Promise(resolve => {
      let data = '';
      req.on('data', c => data += c);
      req.on('end', () => resolve(data));
    });
    opts.body = body;
  }

  try {
    const resp = await fetch(target, opts);
    const data = await resp.text();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = resp.status;
    res.end(data);
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: 'proxy error: ' + e.message }));
  }
};
