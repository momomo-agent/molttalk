const { getRoom } = require('../../../src/store');
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405);
  const { id } = req.query;
  const room = await getRoom(id);
  if (!room) return error(res, 'Room not found', 404);
  const auth = authRoom(req, room);
  if (!auth.ok) return error(res, auth.error, auth.status);
  json(res, { members: room.members });
};
