const { getRoom, saveRoom } = require('../../../src/store');
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, {});
  const { id } = req.query;
  const room = await getRoom(id);
  if (!room) return error(res, 'Room not found', 404);
  const auth = authRoom(req, room);
  if (!auth.ok) return error(res, auth.error, auth.status);

  if (req.method === 'GET') {
    const since = parseInt(req.query.since || '0') || 0;
    return json(res, { messages: room.messages.filter(m => m.ts > since) });
  }
  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.from || !body.text) return error(res, 'from and text required');
    const msg = { from: body.from, text: body.text, type: body.type || 'text', ts: Date.now() };
    room.messages.push(msg);
    const member = room.members.find(m => m.id === body.from || m.name === body.from);
    if (member) member.lastSeen = Date.now();
    await saveRoom(room);
    return json(res, msg, 201);
  }
  error(res, 'Method not allowed', 405);
};
