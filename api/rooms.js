const { createRoom } = require('../src/store');
const { json, error } = require('../src/utils');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'POST') return error(res, 'Method not allowed', 405);
  const body = req.body || {};
  const room = await createRoom(body.name, body.creator);
  json(res, { id: room.id, name: room.name, token: room.token }, 201);
};
