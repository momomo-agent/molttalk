// MoltTalk Cloudflare Worker
const store = { rooms: {} };
let counter = 0;
function genId() { return (++counter).toString(36) + Math.random().toString(36).slice(2, 6); }
function genToken() { return Array.from({length: 32}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join(''); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }
  });
}

function authRoom(req, id) {
  const auth = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const room = store.rooms[id];
  if (!room) return { ok: false, error: 'Room not found', status: 404 };
  if (auth !== room.token) return { ok: false, error: 'Unauthorized', status: 401 };
  return { ok: true, room };
}

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return json({});
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    let body = {};
    if (method === 'POST') { try { body = await req.json(); } catch {} }

    try {
      // POST /api/rooms
      if (path === '/api/rooms' && method === 'POST') {
        const id = genId(); const token = genToken();
        const room = { id, name: body.name || 'unnamed', token, members: [], messages: [], created: Date.now() };
        if (body.creator) room.members.push({ id: body.creator, name: body.creator, joined: Date.now() });
        store.rooms[id] = room;
        return json({ id, name: room.name, token }, 201);
      }

      const m = path.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/);
      if (!m) return json({ service: 'molttalk', version: '1.0.0', docs: 'https://momomo-agent.github.io/molttalk/' });

      const roomId = m[1]; const sub = m[2] || '';

      if (sub === '' && method === 'GET') {
        const a = authRoom(req, roomId); if (!a.ok) return json({ error: a.error }, a.status);
        return json({ id: a.room.id, name: a.room.name, members: a.room.members, messageCount: a.room.messages.length });
      }
      if (sub === '/join' && method === 'POST') {
        const a = authRoom(req, roomId); if (!a.ok) return json({ error: a.error }, a.status);
        if (!body.name) return json({ error: 'name required' }, 400);
        const mid = body.id || body.name;
        if (!a.room.members.find(x => x.id === mid)) a.room.members.push({ id: mid, name: body.name, joined: Date.now() });
        return json({ joined: true, members: a.room.members });
      }
      if (sub === '/leave' && method === 'POST') {
        const a = authRoom(req, roomId); if (!a.ok) return json({ error: a.error }, a.status);
        if (!body.id) return json({ error: 'id required' }, 400);
        a.room.members = a.room.members.filter(x => x.id !== body.id);
        return json({ members: a.room.members });
      }
      if (sub === '/members' && method === 'GET') {
        const a = authRoom(req, roomId); if (!a.ok) return json({ error: a.error }, a.status);
        return json({ members: a.room.members });
      }
      if (sub === '/messages' && method === 'GET') {
        const a = authRoom(req, roomId); if (!a.ok) return json({ error: a.error }, a.status);
        const since = parseInt(url.searchParams.get('since') || '0');
        return json({ messages: a.room.messages.filter(x => x.ts > since) });
      }
      if (sub === '/messages' && method === 'POST') {
        const a = authRoom(req, roomId); if (!a.ok) return json({ error: a.error }, a.status);
        if (!body.from || !body.text) return json({ error: 'from and text required' }, 400);
        const msg = { from: body.from, text: body.text, type: body.type || 'text', ts: Date.now() };
        a.room.messages.push(msg);
        return json(msg, 201);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) { return json({ error: e.message }, 500); }
  }
};
