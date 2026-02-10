// POST /api/rooms/[id]/leave — 离开房间
const { leaveRoom } = require('../../../src/store');
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);
  const { id } = req.query;
  const auth = authRoom(req, id);
  if (!auth.ok) return error(res, auth.error, auth.status);
  const body = req.body || {};
  if (!body.id) return error(res, 'id required');
  const room = leaveRoom(id, body.id);
  if (!room) return error(res, 'Leave failed', 500);
  json(res, { members: room.members });
};
