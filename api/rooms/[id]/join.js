const { getRoom, saveRoom } = require('../../../src/store');
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);
  const { id } = req.query;
  const room = await getRoom(id);
  if (!room) return error(res, 'Room not found', 404);
  const auth = authRoom(req, room);
  if (!auth.ok) return error(res, auth.error, auth.status);
  const body = req.body || {};
  if (!body.name) return error(res, 'name required');
  const mid = body.id || body.name;
  if (!room.members.find(m => m.id === mid)) {
    room.members.push({ id: mid, name: body.name, joined: Date.now(), lastSeen: Date.now() });
  } else {
    const member = room.members.find(m => m.id === mid);
    if (member) member.lastSeen = Date.now();
  }
  await saveRoom(room);
  json(res, { joined: true, members: room.members });
};
