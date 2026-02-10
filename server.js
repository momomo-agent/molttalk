const http = require('http');

// In-memory store
const store = { rooms: {} };
let counter = 0;
function genId() { return (++counter).toString(36) + Math.random().toString(36).slice(2, 6); }
function genToken() { return Array.from({length: 32}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join(''); }

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({}); } });
  });
}

// Auth check
function authRoom(req, id) {
  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  const room = store.rooms[id];
  if (!room) return { ok: false, error: 'Room not found', status: 404 };
  if (auth !== room.token) return { ok: false, error: 'Unauthorized', status: 401 };
  return { ok: true, room };
}

// JSON response
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') { json(res, {}); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method;

  // Routes
  try {
    // POST /api/rooms — create room
    if (path === '/api/rooms' && method === 'POST') {
      const body = await parseBody(req);
      const id = genId();
      const token = genToken();
      const room = { id, name: body.name || 'unnamed', token, members: [], messages: [], created: Date.now() };
      if (body.creator) room.members.push({ id: body.creator, name: body.creator, joined: Date.now() });
      store.rooms[id] = room;
      return json(res, { id, name: room.name, token }, 201);
    }

    // Match /api/rooms/:id/*
    const roomMatch = path.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/);
    if (!roomMatch) {
      // Serve homepage
      return json(res, { service: 'molttalk', version: '1.0.0', docs: 'https://momomo-agent.github.io/molttalk/' });
    }

    const roomId = roomMatch[1];
    const sub = roomMatch[2] || '';

    // GET /api/rooms/:id — room info
    if (sub === '' && method === 'GET') {
      const auth = authRoom(req, roomId);
      if (!auth.ok) return json(res, { error: auth.error }, auth.status);
      const r = auth.room;
      return json(res, { id: r.id, name: r.name, members: r.members, messageCount: r.messages.length });
    }

    // POST /api/rooms/:id/join
    if (sub === '/join' && method === 'POST') {
      const auth = authRoom(req, roomId);
      if (!auth.ok) return json(res, { error: auth.error }, auth.status);
      const body = await parseBody(req);
      if (!body.name) return json(res, { error: 'name required' }, 400);
      const r = auth.room;
      const memberId = body.id || body.name;
      if (!r.members.find(m => m.id === memberId)) {
        r.members.push({ id: memberId, name: body.name, joined: Date.now() });
      }
      return json(res, { joined: true, members: r.members });
    }

    // POST /api/rooms/:id/leave
    if (sub === '/leave' && method === 'POST') {
      const auth = authRoom(req, roomId);
      if (!auth.ok) return json(res, { error: auth.error }, auth.status);
      const body = await parseBody(req);
      if (!body.id) return json(res, { error: 'id required' }, 400);
      auth.room.members = auth.room.members.filter(m => m.id !== body.id);
      return json(res, { members: auth.room.members });
    }

    // GET /api/rooms/:id/members
    if (sub === '/members' && method === 'GET') {
      const auth = authRoom(req, roomId);
      if (!auth.ok) return json(res, { error: auth.error }, auth.status);
      return json(res, { members: auth.room.members });
    }

    // GET /api/rooms/:id/messages
    if (sub === '/messages' && method === 'GET') {
      const auth = authRoom(req, roomId);
      if (!auth.ok) return json(res, { error: auth.error }, auth.status);
      const since = parseInt(url.searchParams.get('since') || '0');
      const msgs = auth.room.messages.filter(m => m.ts > since);
      return json(res, { messages: msgs });
    }

    // POST /api/rooms/:id/messages
    if (sub === '/messages' && method === 'POST') {
      const auth = authRoom(req, roomId);
      if (!auth.ok) return json(res, { error: auth.error }, auth.status);
      const body = await parseBody(req);
      if (!body.from || !body.text) return json(res, { error: 'from and text required' }, 400);
      const msg = { from: body.from, text: body.text, type: body.type || 'text', ts: Date.now() };
      auth.room.messages.push(msg);
      return json(res, msg, 201);
    }

    json(res, { error: 'Not found' }, 404);
  } catch (e) {
    json(res, { error: e.message }, 500);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`MoltTalk running on port ${PORT}`));
