// POST /api/rooms — 创建房间
const { createRoom } = require('../src/store');
const { json, error } = require('../src/utils');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);
  try {
    const room = createRoom(req.body?.name);
    json(res, { id: room.id, name: room.name, token: room.token, created: room.created }, 201);
  } catch (e) {
    error(res, e.message, 500);
  }
};
