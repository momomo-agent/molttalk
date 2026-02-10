const { getRoom } = require('../../src/store');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    return res.status(200).end();
  }

  const { id } = req.query;
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '') || req.query.token || '';
  const room = await getRoom(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.token !== auth) return res.status(403).json({ error: 'Invalid token' });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  let lastTs = parseInt(req.query.since || '0') || 0;

  // Poll and push every 2 seconds
  const interval = setInterval(async () => {
    try {
      const r = await getRoom(id);
      if (!r) { clearInterval(interval); res.end(); return; }
      const newMsgs = r.messages.filter(m => m.ts > lastTs);
      if (newMsgs.length > 0) {
        lastTs = newMsgs[newMsgs.length - 1].ts;
        res.write(`data: ${JSON.stringify({ messages: newMsgs })}\n\n`);
      }
    } catch {}
  }, 2000);

  // Vercel has a 60s timeout for streaming, send keepalive
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(keepalive);
  });
};
