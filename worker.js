// MoltTalk Cloudflare Worker with KV persistence
function genId() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }
function genToken() { return Array.from({length: 32}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join(''); }

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }
  });
}

async function getRoom(env, id) {
  const data = await env.MOLTTALK_STORE.get(`room:${id}`);
  return data ? JSON.parse(data) : null;
}

async function saveRoom(env, room) {
  await env.MOLTTALK_STORE.put(`room:${room.id}`, JSON.stringify(room));
}

function authCheck(req, room) {
  const auth = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (auth !== room.token) return { ok: false, error: 'Unauthorized', status: 401 };
  return { ok: true };
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return json({});
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    let body = {};
    if (method === 'POST') { try { body = await req.json(); } catch {} }

    try {
      // POST /api/rooms — create
      if (path === '/api/rooms' && method === 'POST') {
        const id = genId(); const token = genToken();
        const room = { id, name: body.name || 'unnamed', token, members: [], messages: [], created: Date.now() };
        if (body.creator) room.members.push({ id: body.creator, name: body.creator, joined: Date.now() });
        await saveRoom(env, room);
        return json({ id, name: room.name, token }, 201);
      }

      const m = path.match(/^\/api\/rooms\/([^/]+)(\/.*)?$/);
      if (!m) return json({ service: 'molttalk', version: '1.1.0', docs: 'https://momomo-agent.github.io/molttalk/' });

      const roomId = m[1]; const sub = m[2] || '';
      const room = await getRoom(env, roomId);
      if (!room) return json({ error: 'Room not found' }, 404);
      const auth = authCheck(req, room);
      if (!auth.ok) return json({ error: auth.error }, auth.status);

      // GET /api/rooms/:id
      if (sub === '' && method === 'GET') {
        return json({ id: room.id, name: room.name, members: room.members, messageCount: room.messages.length });
      }
      // POST /api/rooms/:id/join
      if (sub === '/join' && method === 'POST') {
        if (!body.name) return json({ error: 'name required' }, 400);
        const mid = body.id || body.name;
        if (!room.members.find(x => x.id === mid)) room.members.push({ id: mid, name: body.name, joined: Date.now() });
        await saveRoom(env, room);
        return json({ joined: true, members: room.members });
      }
      // POST /api/rooms/:id/leave
      if (sub === '/leave' && method === 'POST') {
        if (!body.id) return json({ error: 'id required' }, 400);
        room.members = room.members.filter(x => x.id !== body.id);
        await saveRoom(env, room);
        return json({ members: room.members });
      }
      // GET /api/rooms/:id/members
      if (sub === '/members' && method === 'GET') {
        return json({ members: room.members });
      }
      // GET /api/rooms/:id/messages
      if (sub === '/messages' && method === 'GET') {
        const since = parseInt(url.searchParams.get('since') || '0');
        return json({ messages: room.messages.filter(x => x.ts > since) });
      }
      // POST /api/rooms/:id/messages
      if (sub === '/messages' && method === 'POST') {
        if (!body.from || !body.text) return json({ error: 'from and text required' }, 400);
        const msg = { from: body.from, text: body.text, type: body.type || 'text', ts: Date.now() };
        room.messages.push(msg);
        await saveRoom(env, room);
        return json(msg, 201);
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) { return json({ error: e.message }, 500); }
  }
};
