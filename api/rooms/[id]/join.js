// POST /api/rooms/[id]/join — 加入房间
const { joinRoom } = require('../../../src/store');
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);
  const { id } = req.query;
  const auth = authRoom(req, id);
  if (!auth.ok) return error(res, auth.error, auth.status);
  const body = req.body || {};
  if (!body.id || !body.name) return error(res, 'id and name required');
  const room = joinRoom(id, { id: body.id, name: body.name });
  if (!room) return error(res, 'Join failed', 500);
  json(res, { members: room.members });
};
