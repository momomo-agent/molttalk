// GET/POST /api/rooms/[id]/messages — 收发消息
const { postMessage, getMessages } = require('../../../src/store');
const { authRoom, json, error } = require('../../../src/utils');

module.exports = async (req, res) => {
  const { id } = req.query;
  const auth = authRoom(req, id);
  if (!auth.ok) return error(res, auth.error, auth.status);

  if (req.method === 'GET') {
    const since = parseInt(req.query.since || '0');
    const limit = Math.min(parseInt(req.query.limit || '50'), 100);
    const msgs = getMessages(id, since, limit);
    return json(res, { messages: msgs });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.sender || !body.content) return error(res, 'sender and content required');
    const msg = postMessage(id, body.sender, body.content, body.type || 'text');
    return json(res, msg, 201);
  }

  return error(res, 'Method not allowed', 405);
};
