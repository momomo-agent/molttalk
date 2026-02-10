// GET /api/rooms/[id]/members — 查看成员
const { getMembers } = require('../../../src/store');
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return error(res, 'Method not allowed', 405);
  const { id } = req.query;
  const auth = authRoom(req, id);
  if (!auth.ok) return error(res, auth.error, auth.status);
  json(res, { members: getMembers(id) });
};
