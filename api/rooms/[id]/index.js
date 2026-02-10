// GET /api/rooms/[id] — 房间信息
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405);
  const { id } = req.query;
  const auth = authRoom(req, id);
  if (!auth.ok) return error(res, auth.error, auth.status);
  const room = auth.room;
  json(res, { id: room.id, name: room.name, created: room.created, members: room.members });
};
